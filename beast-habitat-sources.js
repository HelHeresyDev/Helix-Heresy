// Generated physical-source PROPOSALS and conservative feasibility diagnostics.
// Unverified/rejected proposals never initialize an active population account.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./strategic-world') : root.HelixStrategicWorld,
    node ? require('./strategic-beast-ecology') : root.HelixStrategicBeastEcology,
    node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./local-site-context') : root.HelixLocalSiteContext,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-behavior') : root.HelixBeastBehavior);
  if (node) module.exports = api;
  root.HelixBeastHabitatSources = api;
})(globalThis, function (World, Ecology, Biology, Local, Bodies, Behavior) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x)), clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const random = s => parseInt(World.stableHash(s), 16) / 4294967296;
  const KINDS = Object.freeze(['surface', 'wetland', 'shore', 'waterColumn', 'subsurface']);
  const ORIGINAL_COUNTS = Object.freeze(['beast:rimefang-pack', 'beast:gravebloom-elk', 'beast:mirror-ape']);
  const STOCKS = Object.freeze(['forageKg', 'organicKg', 'detritusKg', 'planktonKg', 'waterL', 'mineralsKg', 'chargeMJ', 'heatMJ', 'excessMana']);
  const productivities = Object.freeze({ I: .01, T: .2, B: 1.2, F: 3, G: 2, S: .5, D: .03, Y: 3, R: 5, A: .1, W: 4 });
  const dot = (a, b) => a.reduce((n, x, i) => n + x * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const pristineCache = new WeakMap();
  function ecologyFor(map) {
    if (map.beastEcology) return map.beastEcology;
    if (!map.pristineBeastEcology) return null;
    // Canonical world maps are immutable. Avoid rebuilding every territory and
    // traditional route separately for each candidate or habitat patch.
    if (!pristineCache.has(map)) pristineCache.set(map, Ecology.expandPristineBeastEcology(map));
    return pristineCache.get(map);
  }
  const populationsFor = map => ecologyFor(map)?.populations || null;
  function cellAreaHa(map, index, topology = World.topologyForMap(map)) {
    const center = topology.vertices[index], corners = topology.cellCornerFaceIndices[index].map(i => topology.faceCenters[i]);
    let steradians = 0;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i], b = corners[(i + 1) % corners.length];
      steradians += 2 * Math.atan2(Math.abs(dot(center, cross(a, b))), 1 + dot(center, a) + dot(a, b) + dot(b, center));
    }
    return steradians * map.topology.planetRadiusKm ** 2 * 100;
  }
  function sourceDigest(map) {
    return World.stableHash({ topology: map.topology, surface: map.surface, relief: map.relief,
      climate: map.climate, hydrology: map.hydrology, biomes: map.biomes, geology: map.geology,
      arcane: map.arcaneGeography, ecology: map.beastEcology, pristineEcology: map.pristineBeastEcology,
      lifecycle: Biology.lifecycle, rates: Biology.rates, antagonisms: Biology.antagonisms });
  }
  const patchId = (index, kind) => `habitat:${index}:${KINDS[kind]}`;
  function patchesForCell(map, index, topology) {
    const area = Math.round(cellAreaHa(map, index, topology) * 10000) / 10000;
    if (map.surface.classes[index] === 'W') return [[index, 3, area]];
    const wet = map.hydrology.wetlandClasses[index] !== '.' || map.hydrology.riverClasses[index] !== '.'
      || map.hydrology.lakeByCell[index] >= 0;
    const shore = map.relief.coastClasses[index] !== '.';
    const wetFraction = wet ? .12 : 0, shoreFraction = shore ? .04 : 0;
    // Surface fractions partition the hex. Subsurface is a separate finite
    // volume, not a second copy of the hex's food or rainfall.
    return [[index, 0, area * (1 - wetFraction - shoreFraction)],
      ...(wet ? [[index, 1, area * wetFraction]] : []), ...(shore ? [[index, 2, area * shoreFraction]] : []),
      [index, 4, area]];
  }
  function expandPatch(map, row, calendar) {
    const [index, kind, areaHa] = row, id = patchId(index, kind), land = map.surface.classes[index] === 'L';
    const biome = map.biomes.classes[index], latitude = World.cellSnapshot(map, index).latitude;
    const yearDays = calendar.monthDays.reduce((n, d) => n + d, 0), areaM2 = areaHa * 10000;
    const wet = kind === 1, marine = kind === 3, underground = kind === 4;
    const depthM = marine ? Math.max(1, -map.relief.elevationM[index]) : wet ? 4 : underground ? 8 : 0;
    const deposit = map.geology.surfaceDepositClasses[index];
    const weatheredM = underground ? .5 : deposit === 'n' ? .002 : .02;
    const densityKgM3 = 1600, mineralKg = marine ? areaM2 * Math.min(depthM, 200) * 35 : areaM2 * weatheredM * densityKgM3;
    const rainLDay = land && !underground ? map.climate.precipitationMm[index] * areaM2 / yearDays : 0;
    const thermal = map.geology.geothermalPermille[index] / 1000;
    const mana = map.arcaneGeography.manaConcentrationPermille[index] / 1000;
    const suppression = map.arcaneGeography.nullPermille[index] / 1000;
    const fertility = (productivities[biome] || .1) * (wet ? 1.5 : 1);
    const seasons = Local.PHASES.map((_, phase) => {
      const localPhase = Local.PHASES[(phase + (latitude < 0 ? 2 : 0)) % Local.PHASES.length];
      const temperatureC = map.climate.temperatureTenthsC[index] / 10
        + map.climate.seasonalRangeTenthsC[index] / 10 * localPhase.temperatureFactor;
      const light = clamp((temperatureC + 15) / 35, .02, 1);
      const plantKg = underground || marine ? 0 : Math.min(fertility * light * areaHa, rainLDay / 5);
      const planktonKg = marine ? areaHa * .3 * light * (map.climate.oceanCurrentClasses[index] === 'U' ? 2 : 1) : 0;
      const renewal = Object.fromEntries(STOCKS.map(key => [key, 0]));
      Object.assign(renewal, { forageKg: plantKg * .7, organicKg: plantKg * .1, detritusKg: plantKg * .2,
        planktonKg: planktonKg * .9, waterL: Math.max(0, rainLDay - plantKg * 5),
        chargeMJ: !underground ? areaHa * map.climate.windStrengthPermille[index] / 1000 * .02 : 0,
        heatMJ: underground ? areaHa * thermal * .1 : 0,
        excessMana: areaHa * mana * (1 - suppression) * .005 });
      renewal.organicKg += planktonKg * .1;
      // These are bounded natural-maintenance potentials, not credits from a
      // creature's disposition. Runtime performed work remains a separate owner.
      const renewalEP = [plantKg * .002, renewal.waterL * 1e-6, plantKg * .0005,
        wet || marine && biome === 'h' ? plantKg * .001 + planktonKg * .001 : 0,
        (plantKg + planktonKg) * .005, renewal.excessMana * .01];
      return { temperatureC, renewal, renewalEP, photosyntheticWaterL: plantKg * 5 };
    });
    const capacity = Object.fromEntries(STOCKS.map(key => [key, Math.max(...seasons.map(s => s.renewal[key])) * yearDays]));
    capacity.mineralsKg = mineralKg;
    capacity.waterL = marine ? 0 : underground ? areaM2 * .01 * 1000 : wet ? areaM2 * depthM * 1000 : areaM2 * .03 * 1000;
    capacity.heatMJ += underground ? mineralKg * .0008 * (20 + thermal * 100) : 0;
    const stocks = Object.fromEntries(STOCKS.map(key => [key, capacity[key] * .5]));
    stocks.mineralsKg = mineralKg;
    return { id, cellId: World.cellId(index), kind: KINDS[kind], areaHa, biome,
      floor: !marine, depthM, oxygen: true, densityKgM3, accessibleMineralDepthM: weatheredM,
      latitude, stocks, capacity, seasons, renewalPerDay: copy(seasons[0].renewal), edges: [],
      condition: Object.fromEntries(Biology.ledgers.map(([id]) => [id, 75])), exhausted: false,
      source: { cellIndex: index, surfaceDeposit: deposit, rainfallLPerDay: rainLDay,
        mineralRenewalKg: 0, meatRenewalKg: 0, plantAllocation: [.7, .1, .2], waterKind: marine ? 'seawater' : 'freshwater',
        mineralBasis: marine ? 'Finite dissolved salts in the original upper water column' : 'Finite accessible weathered substrate; not a new ore deposit' } };
  }
  function compatible(s, patch) {
    if (s.realm === 'ocean' && patch.kind !== 'waterColumn') return false;
    if (s.realm === 'land' && patch.kind === 'waterColumn') return false;
    if (patch.kind === 'subsurface' && !s.movementModes.includes('burrowing')) return false;
    if (s.waterAffinity && patch.kind !== 'wetland' && patch.kind !== 'waterColumn') return false;
    if (s.realm === 'ocean' && patch.depthM < Bodies.profiles[s.id].heightM) return false;
    if (s.id === 'beast:burrowing-furnace' && patch.kind !== 'subsurface') return false;
    return true;
  }
  function originalCount(s, p, habitatHa, seed, calibration) {
    if (ORIGINAL_COUNTS.includes(s.id)) return Number.isSafeInteger(p.devotionalUnitCount) && p.devotionalUnitCount > 0 ? p.devotionalUnitCount : null;
    if (!(habitatHa > 0)) return null;
    if (s.socialPattern === 'hiveColony') return 1 + Math.floor(random(`${seed}:${p.id}:original-hives`) * 3);
    const profile = Biology.lifecycle[s.id];
    const predator = ['carnivore', 'apexPredator'].includes(s.diet);
    const cap = predator ? s.socialPattern === 'matedPair' ? 2 : 12 : s.diet === 'scavenger' ? 24
      : s.sizeBand === 'colossal' ? 128 : s.sizeBand === 'small' ? 2000 : 1000;
    const density = predator ? .0001 / (calibration + 1) : .03 * (calibration + 1);
    const lower = s.socialPattern === 'matedPair' ? 2 : 4;
    const n = Math.max(lower, Math.min(cap, Math.floor(habitatHa / profile.territoryHa * density * (.5 + random(`${seed}:${p.id}:density`)))));
    return n;
  }
  function groupSize(s) {
    return ({ solitary: 1, matedPair: 2, territorialFamily: 4, huntingPack: 6, toolUsingTroop: 6,
      migratoryHerd: 24, migratoryPod: 4, superorganism: 1, burrowColony: 32,
      hiveColony: 1, choralColony: 12, stormSwarm: 100, aerialSchool: 8, driftingFlock: 8, looseHerd: 4 })[s.socialPattern] || 4;
  }
  function foodPotential(patch, key, calendar) {
    return (patch.stocks[key] || 0) / calendar.monthDays.reduce((n, d) => n + d, 0)
      + Math.min(...patch.seasons.map(season => season.renewal[key] || 0));
  }
  function expandGroups(record, map, patches) {
    const populations = populationsFor(map);
    const migrations = new Map((ecologyFor(map).migrations || []).map(m => [m.populationId, m]));
    const patchByCell = new Map();
    for (const p of patches) {
      if (!patchByCell.has(p.cellId)) patchByCell.set(p.cellId, []);
      patchByCell.get(p.cellId).push(p);
    }
    return record.groupRows.map(([pi, ordinal, patchIndex, adults, juveniles]) => {
      const population = populations[pi], s = Ecology.BEAST_SPECIES.find(s => s.id === population.speciesId);
      const profile = Biology.lifecycle[s.id], patch = patches[patchIndex], groupId = `natural-group:${population.id}:${ordinal}`;
      const colony = s.socialPattern === 'hiveColony', id = (suffix) => `${groupId}:${suffix}`;
      const cohort = (suffix, count, ageDays, massKg, role, sex = null) => ({ id: id(suffix), speciesId: s.id, count, ageDays, massKg, role, sex,
        ...(colony ? { colonyId: id('hive') } : {}) });
      const females = adults === 1 ? ordinal % 2 : Math.floor(adults / 2);
      const adultAge = Math.max(profile.adultDays, profile.fertileDays || 0);
      const cohorts = colony ? [cohort('queen', 1, profile.fertileDays, profile.breederKg, 'queen'),
        cohort('males', 2, profile.fertileDays, profile.adultKg, 'male'),
        cohort('workers', adults, profile.adultDays, profile.adultKg, 'worker'),
        cohort('brood', juveniles, profile.adultDays * .25, profile.newbornKg, 'worker')]
        : [...(females ? [cohort('females', females, adultAge, profile.adultKg, 'female', 'female')] : []),
          ...(adults - females ? [cohort('males', adults - females, adultAge, profile.adultKg, 'male', 'male')] : []),
          ...(juveniles ? [cohort('young', juveniles, 0, profile.newbornKg, 'juvenile')] : [])];
      const extentKm = Math.min(10, Math.sqrt(patch.areaHa / Math.PI) / 10);
      const offset = [random(`${record.seed}:${groupId}:x`) * extentKm, random(`${record.seed}:${groupId}:y`) * extentKm];
      const migration = migrations.get(population.id);
      const route = migration && [...migration.cellPath.slice(1), ...migration.cellPath.slice(0, -1).reverse()]
        .map(cellId => (patchByCell.get(cellId) || []).find(p => p.kind === patch.kind && compatible(s, p))?.id || null);
      const dietKeys = Behavior.foodKeys({ speciesId: s.id });
      const foodKey = [...dietKeys].sort((a, b) => foodPotential(patch, b, record.calendar) - foodPotential(patch, a, record.calendar)
        || dietKeys.indexOf(a) - dietKeys.indexOf(b))[0] || 'foodKg';
      return { id: groupId, populationId: population.id, speciesId: s.id, regionId: patch.id, cohorts, dietKeys,
        home: { patchId: patch.id, cellId: patch.cellId, eastKm: offset[0], northKm: offset[1],
          depthM: patch.kind === 'waterColumn' ? Math.min(patch.depthM - .1, Bodies.profiles[s.id].heightM * 1.2) : patch.kind === 'subsurface' ? .5 : 0 },
        resources: { foodKg: foodKey, waterL: 'waterL', mineralsKg: 'mineralsKg' },
        countingBasis: colony ? 'One original queen, actual males, workers and brood' : s.socialPattern === 'superorganism' ? 'One whole original organism per member' : 'Actual individuals; not abundance or an encounter cap',
        knowledge: [], instinct: migration ? { mode: 'instinctive', sourceMigrationId: migration.id,
          route, traditionalCellPath: copy(migration.cellPath), phases: copy(migration.phases),
          homeCellId: migration.homeCellId, seasonalCellId: migration.seasonalCellId,
          oneWayTravelDays: migration.distanceKm / profile.travelKmDay } : null };
    });
  }
  function expand(record, map) {
    const regions = record.patchRows.map(row => expandPatch(map, row, record.calendar));
    const topology = World.topologyForMap(map), byCell = new Map();
    for (const patch of regions) {
      const index = World.cellIndex(patch.cellId);
      if (!byCell.has(index)) byCell.set(index, []);
      byCell.get(index).push(patch);
    }
    for (const patch of regions) {
      const index = World.cellIndex(patch.cellId);
      for (const other of [...byCell.get(index), ...topology.neighbors[index].flatMap(i => byCell.get(i) || [])]) {
        if (other.id === patch.id) continue;
        // Unlike media are not magically joined across a hex. Local surface /
        // wetland / shore approaches are explicit; solid burrow exits and sea
        // entry require their later physical source adapters, not this edge.
        const local = other.cellId === patch.cellId;
        if (local ? ['subsurface', 'waterColumn'].some(kind => [patch.kind, other.kind].includes(kind)) : patch.kind !== other.kind) continue;
        const allowedSpecies = Ecology.BEAST_SPECIES.filter(s => compatible(s, patch) && compatible(s, other)).map(s => s.id);
        if (!allowedSpecies.length) continue;
        patch.edges.push({ id: other.id, distanceKm: local ? .5 : World.greatCircleDistanceKm(map, index, World.cellIndex(other.cellId)),
          traversable: true, allowedSpecies });
      }
    }
    const groups = expandGroups(record, map, regions);
    return { id: record.id, calendar: copy(record.calendar), regions, groups, diagnosticOnly: true };
  }
  function distance(a, b, map) {
    const horizontal = a.home.cellId === b.home.cellId
      ? Math.hypot(a.home.eastKm - b.home.eastKm, a.home.northKm - b.home.northKm)
      : World.greatCircleDistanceKm(map, World.cellIndex(a.home.cellId), World.cellIndex(b.home.cellId));
    return Math.round(Math.hypot(horizontal, (a.home.depthM - b.home.depthM) / 1000) * 1000000) / 1000000;
  }
  function diet(s) { return ['carnivore', 'apexPredator', 'scavenger'].includes(s.diet); }
  function assess(source, map) {
    const issues = [], seasons = [], speciesById = new Map(Ecology.BEAST_SPECIES.map(s => [s.id, s]));
    const pById = new Map(source.regions.map(p => [p.id, p]));
    const groupsByPatch = new Map(source.regions.map(p => [p.id, []])), groupsBySpecies = new Map();
    for (const g of source.groups) {
      groupsByPatch.get(g.regionId).push(g);
      if (!groupsBySpecies.has(g.speciesId)) groupsBySpecies.set(g.speciesId, []);
      groupsBySpecies.get(g.speciesId).push(g);
    }
    for (const patch of source.regions) {
      const occupants = groupsByPatch.get(patch.id), demand = {}, destruction = Biology.ledgers.map(() => 0);
      for (const g of occupants) for (const c of g.cohorts) {
        const p = Biology.lifecycle[g.speciesId], rate = Biology.rates[g.speciesId];
        // Conservative full-adult maintenance, including today's young. This
        // does not award growth or count a projected birth as an existing animal.
        const scale = c.count * Math.max(1, (c.massKg / p.adultKg) ** .75);
        for (const [key, amount] of [[g.resources.foodKg, p.foodKgDay], ['waterL', p.waterLDay], ['mineralsKg', p.mineralsKgDay],
          ['excessMana', p.manaDay], [g.speciesId === 'beast:burrowing-furnace' ? 'heatMJ' : 'chargeMJ', p.otherDay]])
          demand[key] = (demand[key] || 0) + amount * scale;
        rate.destruction.forEach((v, i) => destruction[i] += v * c.count);
      }
      for (let phase = 0; phase < source.calendar.monthDays.length; phase++) {
        const days = source.calendar.monthDays[phase], natural = patch.seasons[phase];
        const deficits = {};
        for (const [key, need] of Object.entries(demand)) {
          if (!need || ['meatKg', 'carrionKg'].includes(key)) continue;
          const available = (patch.stocks[key] || 0) / source.calendar.monthDays.reduce((n, d) => n + d, 0) + (natural.renewal[key] || 0);
          if (need > available + 1e-8) deficits[key] = (need - available) * days;
        }
        destruction.forEach((need, i) => {
          if (patch.kind === 'waterColumn' && ['soilCover', 'freshwaterQuantity', 'freshwaterQuality'].includes(Biology.ledgers[i][0])) return;
          if (need > natural.renewalEP[i] + 1e-8) deficits[`condition:${Biology.ledgers[i][0]}`] = (need - natural.renewalEP[i]) * days;
        });
        if (Object.keys(deficits).length) issues.push({ kind: 'seasonalDeficit', patchId: patch.id, phase, deficits });
        if (occupants.length) seasons.push({ patchId: patch.id, phase, demand: copy(demand), naturalRenewalEP: copy(natural.renewalEP) });
      }
    }
    // A generator-only feasibility allocation. Prey remains alive in the source;
    // this budget is not meat stock, a reservation, or animal migration knowledge.
    const reserved = new Map();
    const prey = source.groups.flatMap(g => g.cohorts.map(c => {
      const protectedCount = c.role === 'queen' ? c.count : c.ageDays < Biology.lifecycle[g.speciesId].adultDays ? 0
        : Math.min(c.count, Math.max(0, 2 - (reserved.get(g.populationId) || 0)));
      if (c.ageDays >= Biology.lifecycle[g.speciesId].adultDays) reserved.set(g.populationId, (reserved.get(g.populationId) || 0) + protectedCount);
      return { group: g, cohort: c, available: c.count - protectedCount, edibleRemaining: 0 };
    }));
    const preyByCell = new Map();
    for (const entry of prey) {
      if (!preyByCell.has(entry.group.home.cellId)) preyByCell.set(entry.group.home.cellId, []);
      preyByCell.get(entry.group.home.cellId).push(entry);
    }
    const foodAllocations = [];
    for (const g of source.groups.filter(g => diet(speciesById.get(g.speciesId)))
      .sort((a, b) => Number(speciesById.get(a.speciesId).diet === 'scavenger') - Number(speciesById.get(b.speciesId).diet === 'scavenger') || a.id.localeCompare(b.id))) {
      const profile = Biology.lifecycle[g.speciesId], size = g.cohorts.reduce((n, c) => n + c.count, 0);
      const days = source.calendar.monthDays.reduce((n, d) => n + d, 0);
      let need = size * profile.foodKgDay * days;
      for (const entry of preyByCell.get(g.home.cellId) || []) {
        if (entry.group.speciesId === g.speciesId || entry.group.home.cellId !== g.home.cellId) continue;
        const patch = pById.get(entry.group.regionId), ownPatch = pById.get(g.regionId);
        if ((patch.kind === 'waterColumn') !== (ownPatch.kind === 'waterColumn') || patch.kind === 'subsurface') continue;
        const scavenger = speciesById.get(g.speciesId).diet === 'scavenger';
        if (distance(g, entry.group, map) > (scavenger ? profile.travelKmDay : Math.min(profile.travelKmDay, Biology.lifecycle[entry.group.speciesId].travelKmDay)) * .5) continue;
        const predatorMass = speciesById.get(g.speciesId).socialPattern === 'huntingPack'
          ? g.cohorts.reduce((n, c) => n + c.massKg * c.count, 0)
          : g.cohorts.reduce((n, c) => Math.max(n, c.massKg), 0);
        if (!scavenger && entry.cohort.massKg > predatorMass * .5) continue;
        const availableKg = (scavenger ? 0 : entry.available * entry.cohort.massKg * .6) + entry.edibleRemaining;
        const used = Math.min(need, availableKg); if (!(used > 0)) continue;
        const newKills = Math.max(0, Math.ceil((used - entry.edibleRemaining - 1e-8) / (entry.cohort.massKg * .6)));
        entry.available -= newKills; entry.edibleRemaining += newKills * entry.cohort.massKg * .6 - used; need -= used;
        foodAllocations.push({ predatorGroupId: g.id, preyCohortId: entry.cohort.id, individuals: newKills, edibleKg: used });
        if (need <= 1e-8) break;
      }
      if (need > 1e-8) issues.push({ kind: 'unfundedPrey', groupId: g.id, requiredKg: need });
    }
    const opposition = [];
    for (const edge of Biology.antagonisms.filter(e => e.nurturer.startsWith('beast:') && e.destroyer.startsWith('beast:'))) {
      const defenders = groupsBySpecies.get(edge.nurturer) || [], targets = groupsBySpecies.get(edge.destroyer) || [];
      let pair = null;
      for (const a of defenders) {
        const b = targets.find(b => {
          if (a.will === false || a.willing === false || !a.cohorts.some(c => c.count > 0 && c.ageDays >= Biology.lifecycle[a.speciesId].adultDays && c.massKg >= Biology.lifecycle[a.speciesId].adultKg * .75)) return false;
          if (a.home.cellId !== b.home.cellId || a.home.patchId !== b.home.patchId || distance(a, b, map) > Biology.lifecycle[a.speciesId].travelKmDay * .25) return false;
          if (edge.id === 'roc-furnace') return false; // No exposed vent/site has been established by a shared hex.
          if (edge.id === 'roc-ashhorn' && !b.cohorts.some(c => c.ageDays < Biology.lifecycle[b.speciesId].adultDays && c.count > 0)) return false;
          return true;
        });
        if (b) { pair = { a, b }; break; }
      }
      if (pair) opposition.push({ edgeId: edge.id, nurturerGroupId: pair.a.id, destroyerGroupId: pair.b.id, distanceKm: distance(pair.a, pair.b, map) });
    }
    const destroyers = new Set(source.groups.filter(g => Biology.roles[g.speciesId] === 'destroying').map(g => g.speciesId));
    for (const speciesId of destroyers) if (!opposition.some(o => Biology.antagonisms.find(e => e.id === o.edgeId).destroyer === speciesId))
      issues.push({ kind: 'unverifiedOpposition', speciesId });
    const migrations = new Map(source.groups.filter(g => g.instinct).map(g => [g.populationId, g.instinct]));
    for (const [populationId, instinct] of migrations) {
      // Preserve the actual traditional route. Static residence arithmetic is
      // not proof of feeding, delays or survival along that seasonal journey.
      issues.push({ kind: 'seasonalResidenceUnverified', populationId, sourceMigrationId: instinct.sourceMigrationId,
        oneWayTravelDays: instinct.oneWayTravelDays, unresolvedRouteHabitat: instinct.route.some(p => p === null) });
    }
    return { status: issues.length ? 'rejected' : 'feasibleInitialCycle', issues, opposition, foodAllocations,
      policy: 'Private generator feasibility only; no performed work, future meat stock, safe destination reservation or perpetual equilibrium guarantee', seasons };
  }
  function candidate(seed, map, patchRows, calibration) {
    const calendar = { epochAt: 0, monthDays: Local.PHASES.map(() => Local.PHASE_DAYS) };
    const patches = patchRows.map(row => expandPatch(map, row, calendar)), groupRows = [], populations = [], unlocated = [];
    const worldPopulations = populationsFor(map);
    for (let pi = 0; pi < worldPopulations.length; pi++) {
      const p = worldPopulations[pi], s = Ecology.BEAST_SPECIES.find(s => s.id === p.speciesId);
      const mask = Uint8Array.from(atob(p.territory.rangeMask), c => c.charCodeAt(0));
      const eligible = patches.map((patch, index) => ({ patch, index })).filter(({ patch }) => {
        const index = World.cellIndex(patch.cellId);
        return Boolean(mask[index >> 3] & (1 << (index & 7))) && compatible(s, patch);
      });
      const n = originalCount(s, p, eligible.reduce((n, row) => n + row.patch.areaHa, 0), seed, calibration);
      populations.push({ populationId: p.id, speciesId: s.id, units: n,
        basis: ORIGINAL_COUNTS.includes(s.id) ? 'Existing authoritative individual units' : s.socialPattern === 'hiveColony' ? 'Explicit original hive count; workers/breeders allocated separately' : 'Seeded habitat/territory-density calibration; not populationIndex or devotional units' });
      if (!eligible.length || n == null) { unlocated.push({ populationId: p.id, speciesId: s.id, count: n, reason: 'Missing supported original count or compatible physical habitat' }); continue; }
      const plantFoods = Behavior.foodKeys({ speciesId: s.id }).filter(key => !['meatKg', 'carrionKg'].includes(key));
      const supplied = plantFoods.length ? eligible.filter(({ patch }) => plantFoods.some(key => foodPotential(patch, key, calendar) >= Biology.lifecycle[s.id].foodKgDay)) : [];
      // Initial allocation may use actual habitat budgets. This preference is
      // never passed to a creature's later movement decision or received map.
      const placementCandidates = supplied.length ? supplied : eligible;
      let left = n, ordinal = 0;
      while (left > 0) {
        const size = Math.min(left, groupSize(s));
        const selected = placementCandidates[Math.floor(random(`${seed}:${p.id}:${ordinal}:home:${calibration}`) * placementCandidates.length)];
        if (s.socialPattern === 'hiveColony') {
          const workers = 200 + Math.floor(random(`${seed}:${p.id}:${ordinal}:workers`) * 1800);
          groupRows.push([pi, ordinal, selected.index, workers, Math.floor(workers / 5)]);
        } else {
          const young = s.socialPattern === 'superorganism' ? 0 : Math.floor(size / 4);
          groupRows.push([pi, ordinal, selected.index, size - young, young]);
        }
        left -= size; ordinal++;
      }
    }
    const record = { id: '', seed, sourceDigest: sourceDigest(map), calendar, patchRows, groupRows, populations, unlocated, calibration };
    const expanded = expand(record, map), assessment = assess(expanded, map);
    for (const p of populations) {
      p.locatedIndividualCount = expanded.groups.filter(g => g.populationId === p.populationId)
        .reduce((n, g) => n + g.cohorts.reduce((sum, c) => sum + c.count, 0), 0);
      p.originalIndividualCount = p.units == null ? null : p.speciesId !== 'beast:ember-ant' ? p.units
        : Array.from({ length: p.units }, (_, ordinal) => {
          const workers = 200 + Math.floor(random(`${seed}:${p.populationId}:${ordinal}:workers`) * 1800);
          return 3 + workers + Math.floor(workers / 5);
        }).reduce((n, count) => n + count, 0);
      p.unlocatedIndividualCount = p.originalIndividualCount == null ? null : p.originalIndividualCount - p.locatedIndividualCount;
    }
    for (const row of unlocated) assessment.issues.push({ kind: 'unlocatedOriginals', ...row });
    assessment.status = assessment.issues.length ? 'rejected' : 'feasibleInitialCycle';
    // Store the compact diagnostic, not a second copy of expanded seasonal stock tables.
    delete assessment.seasons;
    record.assessment = assessment;
    record.id = `beast-habitat-source:${World.stableHash(record)}`; return record;
  }
  function generate(seed, map, options = {}) {
    if (typeof seed !== 'string' || !seed.trim()) throw Error('An original world seed is required');
    if (!map || !populationsFor(map) || !map.geology || !map.arcaneGeography) throw Error('Actual physical world and canonical populations are required');
    if (!Ecology.BEAST_SPECIES.every(s => populationsFor(map).some(p => p.speciesId === s.id))) throw Error('Every authored strategic species must retain its canonical source population');
    const topology = World.topologyForMap(map), patchRows = [];
    for (let i = 0; i < topology.cellCount; i++) patchRows.push(...patchesForCell(map, i, topology));
    let best = null;
    const attempts = Number.isInteger(options.attempts) ? clamp(options.attempts, 1, 3) : 3;
    for (let calibration = 0; calibration < attempts; calibration++) {
      const record = candidate(seed, map, patchRows, calibration);
      if (!best || record.assessment.issues.length < best.assessment.issues.length) best = record;
      if (record.assessment.status === 'feasibleInitialCycle') break;
    }
    return best;
  }
  function validate(record, map, seed = record?.seed) {
    if (!record || record.seed !== seed || record.sourceDigest !== sourceDigest(map)
      || !Number.isInteger(record.calibration) || record.calibration < 0 || record.calibration > 2) throw Error('Habitat source does not match its physical world or authored biology');
    const saved = copy(record); saved.id = '';
    if (record.id !== `beast-habitat-source:${World.stableHash(saved)}`) throw Error('Habitat source identity is invalid');
    const topology = World.topologyForMap(map), patchRows = [];
    for (let i = 0; i < topology.cellCount; i++) patchRows.push(...patchesForCell(map, i, topology));
    const expected = candidate(record.seed, map, patchRows, record.calibration);
    if (JSON.stringify(expected) !== JSON.stringify(record)) throw Error('Habitat source accounts or feasibility diagnostics were changed');
    return record;
  }
  function runtimeSource(record, map) {
    validate(record, map);
    if (map.beastHabitatSources?.id !== record.id) throw Error('Active accounts require the exact archived original source');
    if (record.assessment.status !== 'feasibleInitialCycle') throw Error('Rejected initial allocation is unavailable, not an exhausted or healthy region');
    const result = expand(record, map); result.diagnosticOnly = false; return result;
  }
  function attach(seed, map) {
    const next = World.validateStrategicMap(map);
    if (next.beastHabitatSources) throw Error('Original habitat sources already exist; do not overwrite an archived world');
    next.beastHabitatSources = generate(seed, next);
    return World.finalizeStrategicMap(next);
  }
  return { KINDS, STOCKS, ORIGINAL_COUNTS, cellAreaHa, compatible, sourceDigest, expandPatch,
    expand, assess, generate, validate, runtimeSource, attach, populationsFor };
});
