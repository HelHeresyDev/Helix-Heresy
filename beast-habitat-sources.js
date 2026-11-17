// Generated physical-source PROPOSALS and conservative feasibility diagnostics.
// Unverified/rejected proposals never initialize an active population account.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./strategic-world') : root.HelixStrategicWorld,
    node ? require('./strategic-beast-ecology') : root.HelixStrategicBeastEcology,
    node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./local-site-context') : root.HelixLocalSiteContext,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-behavior') : root.HelixBeastBehavior,
    node ? require('./beast-seasonal-journeys') : root.HelixBeastSeasonalJourneys,
    node ? require('./beast-habitat-bindings') : root.HelixBeastHabitatBindings,
    node ? require('./background-wildlife') : root.HelixBackgroundWildlife,
    node ? require('./beast-parental-care') : root.HelixBeastParentalCare,
    node ? require('./carrion-lantern-biology') : root.HelixCarrionLanternBiology);
  if (node) module.exports = api;
  root.HelixBeastHabitatSources = api;
})(globalThis, function (World, Ecology, Biology, Local, Bodies, Behavior, Journeys, Bindings, Wildlife, Care, Lantern) {
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
  function sourceDigest(map, legacyLantern = false) {
    return World.stableHash({ topology: map.topology, surface: map.surface, relief: map.relief,
      climate: map.climate, hydrology: map.hydrology, biomes: map.biomes, geology: map.geology,
      arcane: map.arcaneGeography, ecology: map.beastEcology, pristineEcology: map.pristineBeastEcology,
      lifecycle: legacyLantern ? Lantern.legacyLifecycle() : Biology.lifecycle, rates: Biology.rates, antagonisms: Biology.antagonisms });
  }
  const patchId = (index, kind) => `habitat:${index}:${KINDS[kind]}`;
  function patchesForCell(map, index, topology, ponds = false) {
    const area = Math.round(cellAreaHa(map, index, topology) * 10000) / 10000;
    if (map.surface.classes[index] === 'W') return [[index, 3, area]];
    const wet = map.hydrology.wetlandClasses[index] !== '.' || map.hydrology.riverClasses[index] !== '.'
      || map.hydrology.lakeByCell[index] >= 0;
    const shore = map.relief.coastClasses[index] !== '.';
    const pond = !wet && ponds && map.climate.precipitationMm[index] > 0;
    const wetFraction = wet ? .12 : pond ? .001 : 0, shoreFraction = shore ? .04 : 0;
    // Surface fractions partition the hex. Subsurface is a separate finite
    // volume, not a second copy of the hex's food or rainfall.
    return [[index, 0, area * (1 - wetFraction - shoreFraction)],
      ...(wet ? [[index, 1, area * wetFraction]] : pond ? [[index, 1, area * wetFraction, 4]] : []), ...(shore ? [[index, 2, area * shoreFraction]] : []),
      [index, 4, area]];
  }
  function expandPatch(map, row, calendar, physical = false) {
    const [index, kind, areaHa] = row, id = patchId(index, kind), land = map.surface.classes[index] === 'L';
    const biome = map.biomes.classes[index], latitude = World.cellSnapshot(map, index).latitude;
    const yearDays = calendar.monthDays.reduce((n, d) => n + d, 0), areaM2 = areaHa * 10000;
    const wet = kind === 1, marine = kind === 3, underground = kind === 4, catchmentPond = wet && row[3] === 4;
    const lakeDepthM = map.hydrology.lakeByCell[index] >= 0 ? Math.max(0, map.hydrology.flowSurfaceM[index] - map.relief.elevationM[index]) : 0;
    const depthM = marine ? Math.max(1, -map.relief.elevationM[index]) : wet ? physical && lakeDepthM > 0 ? lakeDepthM : 4 : underground ? 8 : 0;
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
    if (physical && wet) stocks.waterL = catchmentPond ? areaM2 * .015 * 1000 : capacity.waterL;
    if (physical && marine) stocks.seawaterL = capacity.seawaterL = areaM2 * depthM * 1000;
    return { id, cellId: World.cellId(index), kind: KINDS[kind], areaHa, biome,
      floor: !marine, depthM, oxygen: true, densityKgM3, accessibleMineralDepthM: weatheredM,
      latitude, stocks, capacity, seasons, renewalPerDay: copy(seasons[0].renewal), edges: [],
      condition: Object.fromEntries(Biology.ledgers.map(([id]) => [id, 75])), exhausted: false,
      source: { cellIndex: index, surfaceDeposit: deposit, rainfallLPerDay: rainLDay,
        ...(catchmentPond ? { catchmentPond: true } : {}),
        mineralRenewalKg: 0, meatRenewalKg: 0, plantAllocation: [.7, .1, .2], waterKind: marine ? 'seawater' : 'freshwater',
        mineralBasis: marine ? 'Finite dissolved salts in the original upper water column' : 'Finite accessible weathered substrate; not a new ore deposit' } };
  }
  function compatible(s, patch, physical = false) {
    if (s.realm === 'ocean' && patch.kind !== 'waterColumn') return false;
    if (s.realm === 'land' && patch.kind === 'waterColumn') return false;
    if (patch.kind === 'subsurface' && !s.movementModes.includes('burrowing')) return false;
    if (s.waterAffinity && patch.kind !== 'wetland' && patch.kind !== 'waterColumn') return false;
    if (s.realm === 'ocean' && patch.depthM < Bodies.profiles[s.id].heightM) return false;
    if (s.id === 'beast:burrowing-furnace' && patch.kind !== 'subsurface') return false;
    if (physical && (s.realm === 'ocean' || s.waterAffinity)
      && patch.depthM < (Bodies.profiles[s.id].minWaterDepthM || 0)) return false;
    return true;
  }
  function usableHabitat(s, patch, access = true) {
    if (!compatible(s, patch, true)) return false;
    const p = Biology.lifecycle[s.id], b = Bodies.profiles[s.id];
    if (!patch.seasons.some(season => season.temperatureC >= p.minC && season.temperatureC <= p.maxC)) return false;
    if (patch.kind === 'subsurface' && s.id !== 'beast:burrowing-furnace') return false; // No established underground prey/exit source.
    if (patch.kind === 'wetland' && !s.movementModes.some(mode => ['swimming', 'flight', 'levitation'].includes(mode))) return false;
    if (s.id === 'beast:ironroot-colossus' && (!patch.floor || ['I', 'A'].includes(patch.biome) || patch.source.surfaceDeposit === 'n')) return false;
    // Passage through air is not a resting/nesting site. Test the original
    // young as well as adults; the region has no invented dry bank or perch.
    if (access && patch.kind === 'wetland' && !Bodies.profiles[s.id].modes.some(mode => ['swimming', 'drifting'].includes(mode))
      && b.form !== 'aerostat' && patch.depthM > b.heightM * Math.cbrt(Math.min(1, p.newbornKg / b.massKg)) * .5) return false;
    // A water affinity does not make a dry or too-shallow patch a nursery.
    if (s.waterAffinity || s.realm === 'ocean') return patch.depthM >= b.minWaterDepthM;
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
  function traversableHabitat(s, patch, physical = false) {
    // Flight over a sea is passage through its air, not a new ocean home or
    // permission to increase the species' original habitat/count allocation.
    return compatible(s, patch, physical) || s.realm === 'land' && patch.kind === 'waterColumn'
      && s.movementModes.some(mode => ['flight', 'levitation'].includes(mode));
  }
  function routeDirection(topology, from, to) {
    const a = topology.vertices[from], b = topology.vertices[to], east = cross(a, [0, 1, 0]);
    const length = Math.hypot(...east);
    const e = length > 1e-8 ? east.map(n => n / length) : [0, 0, 1], north = cross(e, a);
    const x = dot(b, e), y = dot(b, north), n = Math.hypot(x, y);
    return n > 1e-8 ? [x / n, y / n] : [1, 0];
  }
  function expandGroups(record, map, patches, physical = false) {
    const populations = populationsFor(map);
    const feeding = new Map((record.feedingRows || []).map(([pi, ordinal, key]) => [`${pi}:${ordinal}`, key]));
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
      if (record.physicalPlacement) {
        const local = Wildlife.initialPosition(patch, record.seed, groupId, record.wildlifeDistribution === true); offset[0] = local.eastM / 1000; offset[1] = local.northM / 1000;
      }
      const migration = migrations.get(population.id);
      const outboundRoute = migration && migration.cellPath.map(cellId => {
        const candidates = (patchByCell.get(cellId) || []).filter(p => traversableHabitat(s, p, physical));
        return (candidates.find(p => p.kind === patch.kind) || candidates.find(p => p.kind === 'surface') || candidates[0])?.id || null;
      });
      const route = migration && [...migration.cellPath.slice(1), ...migration.cellPath.slice(0, -1).reverse()]
        .map(cellId => (patchByCell.get(cellId) || []).find(p => p.kind === patch.kind && compatible(s, p))?.id || null);
      const dietKeys = Behavior.foodKeys({ speciesId: s.id });
      const foodKey = feeding.get(`${pi}:${ordinal}`)
        || [...dietKeys].sort((a, b) => foodPotential(patch, b, record.calendar) - foodPotential(patch, a, record.calendar)
        || dietKeys.indexOf(a) - dietKeys.indexOf(b))[0] || 'foodKg';
      return { id: groupId, populationId: population.id, speciesId: s.id, regionId: patch.id, cohorts, dietKeys,
        ...(record.physicalPlacement ? { parentalCare: Care.mode(s.id) } : {}),
        ...(record.windTransport && s.id === 'beast:carrion-lantern' ? { windDriven: true } : {}),
        home: { patchId: patch.id, cellId: patch.cellId, eastKm: offset[0], northKm: offset[1],
          depthM: s.movementModes.some(mode => ['flight', 'levitation'].includes(mode)) ? 0
            : patch.kind === 'waterColumn' || record.physicalPlacement && patch.kind === 'wetland'
              ? Math.min(patch.depthM - .1, Bodies.profiles[s.id].heightM * 1.2) : patch.kind === 'subsurface' ? .5 : 0 },
        resources: { foodKg: foodKey, waterL: 'waterL', mineralsKg: 'mineralsKg' },
        countingBasis: colony ? 'One original queen, actual males, workers and brood' : s.socialPattern === 'superorganism' ? 'One whole original organism per member' : 'Actual individuals; not abundance or an encounter cap',
        knowledge: [], instinct: migration ? { mode: 'instinctive', sourceMigrationId: migration.id,
          route, traditionalCellPath: copy(migration.cellPath), phases: copy(migration.phases),
          homeCellId: migration.homeCellId, seasonalCellId: migration.seasonalCellId,
          oneWayTravelDays: migration.distanceKm / profile.travelKmDay,
          seasonal: { outboundRoute, phases: copy(migration.phases) } } : null };
    });
  }
  function expand(record, map, options = {}) {
    const regions = record.patchRows.map(row => expandPatch(map, row, record.calendar, Boolean(record.physicalBinding || options.physical)));
    const topology = World.topologyForMap(map), byCell = new Map();
    for (const patch of regions) {
      const index = World.cellIndex(patch.cellId);
      if (record.windTransport && patch.kind !== 'subsurface') {
        const angle = map.climate.windBearingDeg[index] * Math.PI / 180, speed = map.climate.windStrengthPermille[index] / 100;
        patch.wind = { x: Math.sin(angle) * speed, y: Math.cos(angle) * speed };
      }
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
        if ([patch.kind, other.kind].includes('subsurface') && local) continue;
        const mixed = patch.kind !== other.kind;
        const allowedSpecies = Ecology.BEAST_SPECIES.filter(s => traversableHabitat(s, patch, Boolean(record.physicalBinding || options.physical))
          && traversableHabitat(s, other, Boolean(record.physicalBinding || options.physical))
          && (!mixed || local && ![patch.kind, other.kind].includes('waterColumn')
            || s.movementModes.some(mode => ['flight', 'levitation'].includes(mode))
            || [patch.kind, other.kind].every(kind => ['surface', 'shore'].includes(kind)))).map(s => s.id);
        if (!allowedSpecies.length) continue;
        const otherIndex = World.cellIndex(other.cellId), distanceKm = local ? .5 : World.greatCircleDistanceKm(map, index, otherIndex);
        const out = local ? [1, 0] : routeDirection(topology, index, otherIndex), back = local ? [-1, 0] : routeDirection(topology, otherIndex, index);
        patch.edges.push({ id: other.id, distanceKm,
          traversable: true, allowedSpecies,
          ...(record.physicalPlacement ? {
            departurePosition: { regionId: patch.id, eastM: 0, northM: 0, altitudeM: 0 },
            arrivalPosition: { regionId: other.id, eastM: 0, northM: 0, altitudeM: 0 },
            routeFrames: {
              exit: { regionId: patch.id, eastM: out[0] * distanceKm * 500, northM: out[1] * distanceKm * 500, altitudeM: 0 },
              entry: { regionId: other.id, eastM: back[0] * distanceKm * 500, northM: back[1] * distanceKm * 500, altitudeM: 0 }
            },
            ...(record.windTransport && !local ? { windBoundary: { normal: { x: out[0], y: out[1] }, offsetM: distanceKm * 500,
              exit: { eastM: out[0] * distanceKm * 500, northM: out[1] * distanceKm * 500 },
              entry: { eastM: back[0] * distanceKm * 500, northM: back[1] * distanceKm * 500 } } } : {})
          } : {}) });
      }
    }
    const groups = expandGroups(record, map, regions, Boolean(record.physicalBinding || options.physical));
    const result = { id: record.id, calendar: copy(record.calendar), regions, groups, diagnosticOnly: true,
      unlocated: copy(record.unlocated || []), regionalFoodWeb: Boolean(record.physicalBinding),
      ...(record.physicalPlacement ? { spatialContinuity: true } : {}) };
    if (record.physicalBinding && !options.raw) Bindings.apply(result, record.physicalBinding, map);
    if (record.backgroundWildlife && !options.raw) Wildlife.apply(result, record.backgroundWildlife);
    if (record.lanternMoisture) for (const r of result.regions) if (r.kind !== 'subsurface') {
      const index = r.source.cellIndex;
      // An explicit climate proxy, not measured daily weather or an animal's
      // knowledge. Existing atmospheric stock remains shared with other work.
      const humidity = r.kind === 'waterColumn' ? 75 : clamp(20 + map.climate.aridityIndexPermille[index] * .04, 10, 90);
      r.humidity = humidity; r.seasons.forEach(season => { season.humidity = humidity; });
      if (r.kind === 'waterColumn') {
        const minimumDepth = Math.max(0, ...groups.filter(g => g.regionId === r.id).map(g => Bodies.profiles[g.speciesId].minWaterDepthM || 0));
        const before = r.stocks.seawaterL, minimum = r.areaHa * 10000 * minimumDepth * 1000;
        const target = Math.min(before * .000001, r.areaHa * 10000 * .001, Math.max(0, before - minimum));
        r.stocks.seawaterL = Math.max(minimum, before - target);
        const litres = before - r.stocks.seawaterL; // Transfer the representable debit, not a rounded promise.
        r.stocks.atmosphericWaterL = litres; r.capacity.atmosphericWaterL = litres;
        r.source.evaporatedSeawaterL = litres; // Finite initial evaporation, no renewed ocean or fresh-water spring.
      }
    }
    return result;
  }
  function distance(a, b, map) {
    const horizontal = a.home.cellId === b.home.cellId
      ? Math.hypot(a.home.eastKm - b.home.eastKm, a.home.northKm - b.home.northKm)
      : World.greatCircleDistanceKm(map, World.cellIndex(a.home.cellId), World.cellIndex(b.home.cellId));
    return Math.round(Math.hypot(horizontal, (a.home.depthM - b.home.depthM) / 1000) * 1000000) / 1000000;
  }
  function diet(s) { return ['carnivore', 'apexPredator', 'scavenger'].includes(s.diet); }
  function residenceAudit(source) {
    const until = source.calendar.monthDays.reduce((n, d) => n + d, 0) * Journeys.DAY;
    const regions = new Map(source.regions.map(r => [r.id, r])), budgets = new Map(), totals = new Map();
    const changes = [], issues = [], journeys = [];
    for (const g of source.groups) {
      const p = Biology.lifecycle[g.speciesId], trace = Journeys.trace(g, regions, source.calendar, until, p.travelKmDay);
      if (g.instinct?.seasonal) {
        const failures = trace.events.filter(e => e.kind === 'seasonalBlocked' || e.kind === 'seasonalLegArrived' && e.late);
        const unfinished = trace.seasonal?.active;
        if (unfinished && ['waiting', 'travelling'].includes(unfinished.status) && unfinished.arrivalWindow.end <= until)
          failures.push({ kind: 'seasonalLegArrived', leg: unfinished.leg, at: unfinished.arrivalWindow.end,
            reason: 'Original journey remains unfinished after its arrival window', late: true });
        for (const event of failures) issues.push({ kind: event.kind === 'seasonalBlocked' ? 'seasonalRouteBlocked' : 'lateSeasonalArrival',
          populationId: g.populationId, groupId: g.id, at: event.at, leg: event.leg, reason: event.reason || 'Arrival missed its original seasonal window' });
        journeys.push({ groupId: g.id, populationId: g.populationId,
          departures: trace.events.filter(e => e.kind === 'departure').length,
          arrivals: trace.events.filter(e => e.kind === 'seasonalLegArrived').length,
          travellingDays: trace.segments.filter(segment => segment.travelling).reduce((n, segment) => n + (segment.to - segment.from) / Journeys.DAY, 0),
          transitAtCycleEnd: Boolean(trace.transit), failures: failures.length });
      }
      const scale = g.cohorts.reduce((n, c) => n + c.count * Math.max(1, (c.massKg / p.adultKg) ** .75), 0);
      const members = g.cohorts.reduce((n, c) => n + c.count, 0);
      for (const segment of trace.segments) {
        const phase = Journeys.monthAt(source.calendar, segment.from).season, days = (segment.to - segment.from) / Journeys.DAY;
        const demands = {}, effort = segment.travelling ? p.travelMultiplier : 1;
        for (const [key, amount] of [[g.resources.foodKg, p.foodKgDay], ['waterL', p.waterLDay], ['mineralsKg', p.mineralsKgDay],
          ['excessMana', p.manaDay], [g.speciesId === 'beast:burrowing-furnace' ? 'heatMJ' : 'chargeMJ', p.otherDay]])
          if (amount > 0) demands[key] = (demands[key] || 0) + amount * scale * effort;
        if (!totals.has(segment.regionId)) totals.set(segment.regionId, source.calendar.monthDays.map(() => ({ demand: {}, individualDays: {} })));
        const total = totals.get(segment.regionId)[phase];
        for (const [key, amount] of Object.entries(demands)) total.demand[key] = (total.demand[key] || 0) + amount * days;
        total.individualDays[g.speciesId] = (total.individualDays[g.speciesId] || 0) + members * days;
        changes.push({ at: segment.from, regionId: segment.regionId, demands, sign: 1 },
          { at: segment.to, regionId: segment.regionId, demands, sign: -1 });
      }
    }
    function settle(regionId, at) {
      const r = regions.get(regionId);
      let budget = budgets.get(regionId);
      if (!budget) { budget = { at: 0, stocks: copy(r.stocks), demand: {} }; budgets.set(regionId, budget); }
      while (budget.at < at - 1e-8) {
        const month = Journeys.monthAt(source.calendar, budget.at), end = Math.min(at, month.end), days = (end - budget.at) / Journeys.DAY;
        const renewal = r.seasons[month.season].renewal;
        for (const key of new Set([...Object.keys(renewal), ...Object.keys(budget.demand)])) {
          const need = Math.max(0, budget.demand[key] || 0), net = (renewal[key] || 0) - need;
          const stock = budget.stocks[key] || 0, next = stock + net * days;
          if (next < -1e-7) issues.push({ kind: 'seasonalResourceDeficit', patchId: regionId, phase: month.season,
            resource: key, missingAmount: -next, at: budget.at + (net < 0 ? stock / -net * Journeys.DAY : 0),
            until: end });
          budget.stocks[key] = Math.max(0, Math.min(r.capacity[key] || 0, next));
        }
        budget.at = end;
      }
      return budget;
    }
    changes.sort((a, b) => a.at - b.at);
    for (let i = 0; i < changes.length;) {
      const at = changes[i].at;
      const atTime = new Map();
      for (; i < changes.length && changes[i].at === at; i++) {
        const change = changes[i];
        if (!atTime.has(change.regionId)) atTime.set(change.regionId, {});
        const delta = atTime.get(change.regionId);
        for (const [key, amount] of Object.entries(change.demands)) delta[key] = (delta[key] || 0) + amount * change.sign;
      }
      for (const [regionId, delta] of atTime) {
        const budget = settle(regionId, at);
        for (const [key, amount] of Object.entries(delta)) budget.demand[key] = Math.max(0, (budget.demand[key] || 0) + amount);
      }
    }
    for (const regionId of budgets.keys()) settle(regionId, until);
    return { issues, journeys, totals, until };
  }
  function forecast(source, map) {
    const residence = residenceAudit(source), issues = [...residence.issues], seasons = [], speciesById = new Map(Ecology.BEAST_SPECIES.map(s => [s.id, s]));
    const pById = new Map(source.regions.map(p => [p.id, p]));
    const groupsBySpecies = new Map();
    for (const g of source.groups) {
      if (!groupsBySpecies.has(g.speciesId)) groupsBySpecies.set(g.speciesId, []);
      groupsBySpecies.get(g.speciesId).push(g);
    }
    for (const patch of source.regions) {
      for (let phase = 0; phase < source.calendar.monthDays.length; phase++) {
        const days = source.calendar.monthDays[phase], natural = patch.seasons[phase];
        const total = residence.totals.get(patch.id)?.[phase], deficits = {}, demand = total?.demand || {};
        const destruction = Biology.ledgers.map(() => 0);
        for (const [speciesId, individualDays] of Object.entries(total?.individualDays || {}))
          Biology.rates[speciesId].destruction.forEach((v, i) => destruction[i] += v * individualDays / days);
        destruction.forEach((need, i) => {
          if (patch.kind === 'waterColumn' && ['soilCover', 'freshwaterQuantity', 'freshwaterQuality'].includes(Biology.ledgers[i][0])) return;
          const available = Array.isArray(natural.renewalEP) ? natural.renewalEP[i] : natural.renewalEP[Biology.ledgers[i][0]];
          if (need > available + 1e-8) deficits[`condition:${Biology.ledgers[i][0]}`] = (need - available) * days;
        });
        if (Object.keys(deficits).length) issues.push({ kind: 'seasonalDeficit', patchId: patch.id, phase, deficits });
        if (total) seasons.push({ patchId: patch.id, phase, demand: copy(demand), naturalRenewalEP: copy(natural.renewalEP) });
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
    return { status: issues.length ? 'rejected' : 'feasibleInitialCycle', issues, opposition, foodAllocations,
      policy: 'Private generator feasibility only; original-body residence and supply replay, no performed nurturing, future meat stock, safe destination reservation or perpetual equilibrium guarantee',
      seasonalJourneys: residence.journeys, seasons };
  }
  function candidate(seed, map, patchRows, calibration, physical = true, wildlife = false, physicalPlacement = false, habitatAccess = false, windTransport = false, lanternMoisture = false, wildlifeDistribution = false, wildlifeCarcasses = false, establishedHabitats = false) {
    const calendar = { epochAt: 0, monthDays: Local.PHASES.map(() => Local.PHASE_DAYS) };
    const patches = patchRows.map(row => expandPatch(map, row, calendar, physical)), groupRows = [], populations = [], unlocated = [];
    const worldPopulations = populationsFor(map), foodUse = new Map(), feedingRows = [];
    const migrations = new Map((ecologyFor(map).migrations || []).map(m => [m.populationId, m]));
    for (let pi = 0; pi < worldPopulations.length; pi++) {
      const p = worldPopulations[pi], s = Ecology.BEAST_SPECIES.find(s => s.id === p.speciesId);
      const mask = Uint8Array.from(atob(p.territory.rangeMask), c => c.charCodeAt(0));
      const originalHabitat = patches.map((patch, index) => ({ patch, index })).filter(({ patch }) => {
        const index = World.cellIndex(patch.cellId);
        return Boolean(mask[index >> 3] & (1 << (index & 7))) && compatible(s, patch, physical);
      });
      const eligible = physicalPlacement ? originalHabitat.filter(({ patch }) => usableHabitat(s, patch, habitatAccess)) : originalHabitat;
      // Placement repair cannot change the original source count to hide a
      // difficult population. Unsupported sources retain their unlocated count.
      const n = originalCount(s, p, originalHabitat.reduce((n, row) => n + row.patch.areaHa, 0), seed, calibration);
      populations.push({ populationId: p.id, speciesId: s.id, units: n,
        basis: ORIGINAL_COUNTS.includes(s.id) ? 'Existing authoritative individual units' : s.socialPattern === 'hiveColony' ? 'Explicit original hive count; workers/breeders allocated separately' : 'Seeded habitat/territory-density calibration; not populationIndex or devotional units' });
      if (!eligible.length || n == null) { unlocated.push({ populationId: p.id, speciesId: s.id, count: n, reason: 'Missing supported original count or compatible physical habitat' }); continue; }
      const plantFoods = Behavior.foodKeys({ speciesId: s.id }).filter(key => !['meatKg', 'carrionKg'].includes(key));
      const supplied = plantFoods.length ? eligible.filter(({ patch }) => plantFoods.some(key => foodPotential(patch, key, calendar) >= Biology.lifecycle[s.id].foodKgDay)) : [];
      // Initial allocation may use actual habitat budgets. This preference is
      // never passed to a creature's later movement decision or received map.
      const migration = migrations.get(p.id);
      const homeCandidates = migration ? eligible.filter(({ patch }) => patch.cellId === migration.homeCellId) : [];
      const surfaceHome = homeCandidates.filter(({ patch }) => patch.kind === 'surface');
      const reefs = physical && s.id === 'beast:reef-wyrm' ? eligible.filter(({ patch }) => patch.biome === 'h') : [];
      let placementCandidates = surfaceHome.length ? surfaceHome : homeCandidates.length ? homeCandidates : reefs.length ? reefs : supplied.length ? supplied : eligible;
      if (physicalPlacement) {
        const yearRound = placementCandidates.filter(({ patch }) => patch.seasons.every(season => season.temperatureC >= Biology.lifecycle[s.id].minC
          && season.temperatureC <= Biology.lifecycle[s.id].maxC));
        if (yearRound.length) placementCandidates = yearRound;
      }
      let left = n, ordinal = 0;
      while (left > 0) {
        const size = Math.min(left, groupSize(s));
        let selected = placementCandidates[Math.floor(random(`${seed}:${p.id}:${ordinal}:home:${calibration}`) * placementCandidates.length)];
        if (habitatAccess && plantFoods.length) {
          const profile = Biology.lifecycle[s.id], young = s.socialPattern === 'superorganism' ? 0 : Math.floor(size / 4);
          const need = (size - young) * profile.foodKgDay + young * (profile.foodKgDay * (profile.newbornKg / profile.adultKg) ** .75
            * profile.juvenileMultiplier + Math.max(0, profile.adultKg - profile.newbornKg) * .8 / Math.max(1, profile.adultDays) / profile.assimilation);
          // Private INITIAL allocation only. Spend a shared seasonal food budget
          // across groups/species rather than repeatedly selecting one tiny pond.
          // No stock is credited, and a deficit remains a rejected proposal.
          const choices = placementCandidates.flatMap(row => plantFoods.map(key => ({ ...row, key,
            remaining: foodPotential(row.patch, key, calendar) - (foodUse.get(`${row.index}:${key}`) || 0),
            tie: random(`${seed}:${p.id}:${ordinal}:${row.index}:${key}`) })))
            .sort((a, b) => Number(b.remaining >= need) - Number(a.remaining >= need)
              || b.remaining / Math.max(1, need) - a.remaining / Math.max(1, need) || a.tie - b.tie);
          selected = choices[0]; feedingRows.push([pi, ordinal, selected.key]);
          const key = `${selected.index}:${selected.key}`; foodUse.set(key, (foodUse.get(key) || 0) + need);
        }
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
    const record = { id: '', seed, sourceDigest: sourceDigest(map), calendar, patchRows, groupRows, populations, unlocated, calibration,
      ...(physicalPlacement ? { physicalPlacement: true } : {}), ...(habitatAccess ? { habitatAccess: true, feedingRows } : {}),
      ...(windTransport ? { windTransport: true } : {}), ...(lanternMoisture ? { lanternMoisture: true } : {}),
      ...(wildlifeDistribution ? { wildlifeDistribution: true } : {}) };
    if (wildlifeCarcasses) record.wildlifeCarcasses = true;
    if (establishedHabitats) record.establishedHabitats = true;
    const expanded = expand(record, map, { physical, raw: true });
    if (physical) { record.physicalBinding = Bindings.allocate(expanded, map, { positions: physicalPlacement, established: establishedHabitats }); Bindings.apply(expanded, record.physicalBinding, map); }
    if (wildlife) { record.backgroundWildlife = Wildlife.allocate(expanded, seed, { distributed: wildlifeDistribution, carcassBatches: wildlifeCarcasses }); Wildlife.apply(expanded, record.backgroundWildlife); }
    const assessment = forecast(expanded, map);
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
    for (let i = 0; i < topology.cellCount; i++) patchRows.push(...patchesForCell(map, i, topology, options.physicalPlacement !== false));
    let best = null;
    const attempts = Number.isInteger(options.attempts) ? clamp(options.attempts, 1, 3) : 3;
    for (let calibration = 0; calibration < attempts; calibration++) {
      const record = candidate(seed, map, patchRows, calibration, true, options.backgroundWildlife !== false, options.physicalPlacement !== false,
        options.physicalPlacement !== false && options.habitatAccess !== false, options.physicalPlacement !== false && options.windTransport !== false,
        options.physicalPlacement !== false && options.lanternMoisture !== false,
        options.backgroundWildlife !== false && options.physicalPlacement !== false && options.wildlifeDistribution !== false,
        options.backgroundWildlife !== false && options.physicalPlacement !== false && options.wildlifeDistribution !== false && options.wildlifeCarcasses !== false,
        options.physicalPlacement !== false && options.establishedHabitats !== false);
      if (!best || record.assessment.issues.length < best.assessment.issues.length) best = record;
      if (record.assessment.status === 'feasibleInitialCycle') break;
    }
    return best;
  }
  function validate(record, map, seed = record?.seed) {
    const currentDigest = sourceDigest(map), legacyDigest = record?.lanternMoisture == null ? sourceDigest(map, true) : null;
    if (!record || record.seed !== seed || record.sourceDigest !== currentDigest && record.sourceDigest !== legacyDigest
      || !Number.isInteger(record.calibration) || record.calibration < 0 || record.calibration > 2) throw Error('Habitat source does not match its physical world or authored biology');
    const saved = copy(record); saved.id = '';
    if (record.id !== `beast-habitat-source:${World.stableHash(saved)}`) throw Error('Habitat source identity is invalid');
    const topology = World.topologyForMap(map), patchRows = [];
    for (let i = 0; i < topology.cellCount; i++) patchRows.push(...patchesForCell(map, i, topology, record.physicalPlacement === true));
    const expected = candidate(record.seed, map, patchRows, record.calibration, Boolean(record.physicalBinding), Boolean(record.backgroundWildlife), record.physicalPlacement === true,
      record.habitatAccess === true, record.windTransport === true, record.lanternMoisture === true, record.wildlifeDistribution === true, record.wildlifeCarcasses === true, record.establishedHabitats === true);
    if (record.sourceDigest === legacyDigest) expected.sourceDigest = record.sourceDigest;
    const physical = value => { const result = copy(value); delete result.id; delete result.assessment; delete result.groupRows; return result; };
    if (World.stableHash(physical(expected)) !== World.stableHash(physical(record))) throw Error('Habitat source physical accounts were changed');
    if (record.physicalBinding && World.stableHash(expected.groupRows) !== World.stableHash(record.groupRows)) throw Error('Original bound habitat placement was changed');
    const templates = new Map(expected.groupRows.map(row => [`${row[0]}:${row[1]}`, row]));
    const masks = new Map(), populations = populationsFor(map), patches = patchRows.map(row => expandPatch(map, row, record.calendar));
    for (const row of record.groupRows) {
      if (!Array.isArray(row) || row.length !== 5 || !row.every(n => Number.isSafeInteger(n) && n >= 0)) throw Error('Invalid original group row');
      const key = `${row[0]}:${row[1]}`, template = templates.get(key), population = populations[row[0]], patch = patches[row[2]];
      if (!template || !patch || row[3] !== template[3] || row[4] !== template[4]) throw Error('Original cohort counts were changed');
      templates.delete(key);
      if (!masks.has(population.id)) masks.set(population.id, Uint8Array.from(atob(population.territory.rangeMask), c => c.charCodeAt(0)));
      const index = World.cellIndex(patch.cellId), mask = masks.get(population.id);
      if (!(mask[index >> 3] & (1 << (index & 7))) || !compatible(Ecology.BEAST_SPECIES.find(s => s.id === population.speciesId), patch)) throw Error('Original group has no physical habitat');
    }
    if (templates.size || !record.assessment || !Array.isArray(record.assessment.issues)
      || !['rejected', 'feasibleInitialCycle'].includes(record.assessment.status)) throw Error('Incomplete original source proposal');
    // Archived diagnostics are immutable advisory results, not live capacity
    // certificates. Replaying improved diagnostics must not rewrite a world.
    // Activation below still recomputes current feasibility before use.
    return record;
  }
  const assessmentToken = Symbol('normalized private replay');
  function assess(source, map, options = {}) {
    // The archived generator forecast remains reproducible advisory data. Its
    // hypothetical kills, baseline stocks and natural-only ledger estimate are
    // not observations of the executed food web or paid nurturing.
    const preliminary = map && source.groups.every(g => g.home) ? forecast(source, map) : null;
    const warnings = copy(preliminary?.issues || []);
    const issues = copy(source.unlocated || []).map(row => ({ kind: 'unlocatedOriginals', ...row }));
    const result = { stage: options.account ? 'measured' : 'preliminary', status: 'unverified',
      prediction: preliminary?.status || 'unavailable', warnings, issues,
      policy: 'Private elapsed-source assessment; forecasts are warnings, only performed supply/work and retained habitat history establish interval support; never native adoption' };
    if (!options.account) return result;
    const P = typeof module === 'object' && module.exports ? require('./beast-populations') : globalThis.HelixBeastPopulations;
    const account = options.token === assessmentToken ? options.account : P?.normalize(options.account, options.binding);
    if (!account) { result.status = 'rejected'; issues.push({ kind: 'invalidMeasuredAccount' }); return result; }
    const originalCounts = {}, originalCohorts = source.groups.flatMap(g => g.cohorts.map(c => ({ g, c })));
    for (const g of source.groups) originalCounts[g.populationId] = (originalCounts[g.populationId] || 0) + g.cohorts.reduce((n, c) => n + c.count, 0);
    const same = (a, b) => a !== undefined && b !== undefined && World.stableHash(a) === World.stableHash(b);
    if (account.sourceId !== source.id || !same(account.calendar, source.calendar)
      || !same(account.originalCounts, originalCounts)
      || !same(account.regions.map(r => r.id).sort(), source.regions.map(r => r.id).sort())
      || originalCohorts.some(({ g, c }) => !same(account.origins[c.id], { populationId: g.populationId, speciesId: c.speciesId, count: c.count }))) {
      result.status = 'rejected'; issues.push({ kind: 'measuredSourceScopeMismatch' }); return result;
    }
    const cycleEnd = source.calendar.epochAt + source.calendar.monthDays.reduce((n, d) => n + d, 0) * Journeys.DAY;
    const unresolved = [], ecology = [];
    if (account.appliedAt < account.clock - 1e-8 || Object.values(account.regionClocks || {}).some(c => c.appliedAt < account.clock - 1e-8))
      unresolved.push('Regional accounts are not settled through the measured endpoint');
    const species = [...new Set(source.groups.map(g => g.speciesId))].sort();
    if (options.requireCatalog && Ecology.BEAST_SPECIES.some(s => !species.includes(s.id))) issues.push({ kind: 'missingOriginalCatalogSpecies' });
    for (const r of account.regions) {
      for (const [resource, missingAmount] of Object.entries(r.unmetTotals || {}))
        if (missingAmount > 1e-8) issues.push({ kind: 'performedResourceShortfall', regionId: r.id, resource, missingAmount });
      const a = r.ecologicalAccount, history = a?.viabilityHistory;
      if (!r.ecology || !history || history.startedAt !== source.calendar.epochAt) {
        unresolved.push(`No complete observed habitat history for ${r.id}`); continue;
      }
      if (account.clock >= cycleEnd && !history.completedCycles) unresolved.push(`No complete seasonal maintenance history for ${r.id}`);
      const balanceEP = Object.fromEntries(Bindings.channels.map(k => [k, a.natural[k] + a.nurturing[k] - a.destruction[k]]));
      const minimumCondition = Object.fromEntries(Bindings.channels.map(k => [k, Math.min(history.minimumCondition[k], r.condition[k])]));
      ecology.push({ regionId: r.id, natural: copy(a.natural), nurturing: copy(a.nurturing), destruction: copy(a.destruction),
        balanceEP, minimumCondition, condition: copy(r.condition), exhausted: r.exhausted });
      for (const [channel, floor] of Object.entries(r.ecology.viabilityFloors)) {
        if (minimumCondition[channel] < floor - 1e-8) issues.push({ kind: 'performedHabitatFloorBreach', regionId: r.id, channel,
          floor, minimum: minimumCondition[channel], ...(history.floorBreaches[channel] || {}) });
        // Seasonal buffers may cover a temporary low. A whole-cycle negative
        // maintenance balance is not sustainable maintenance even above the floor.
        if (history.maintenanceFailures[channel])
          issues.push({ kind: 'performedMaintenanceDeficit', regionId: r.id, channel, ...copy(history.maintenanceFailures[channel]) });
        else if (account.clock >= cycleEnd && balanceEP[channel] < -1e-8)
          issues.push({ kind: 'performedMaintenanceDeficit', regionId: r.id, channel, missingEP: -balanceEP[channel], basis: 'Observed elapsed aggregate; cycle detail unavailable' });
      }
    }
    const scarcity = [];
    for (const g of account.groups) for (const c of g.cohorts) if (c.firstScarcity) scarcity.push({ speciesId: g.speciesId,
      groupId: g.id, originId: c.originId, ...copy(c.firstScarcity) });
    const deaths = new Map();
    for (const loss of [...account.losses, ...(account.lossBatches || [])]) if (['starvation', 'dehydration'].includes(loss.cause)) {
      const key = `${loss.speciesId}:${loss.regionId}:${loss.cause}`;
      if (!deaths.has(key)) deaths.set(key, { kind: 'performedScarcityDeath', speciesId: loss.speciesId, regionId: loss.regionId, cause: loss.cause, count: 0 });
      deaths.get(key).count += loss.count || 1;
      if (loss.context?.firstFailure) scarcity.push({ speciesId: loss.speciesId, groupId: loss.groupId,
        originId: loss.originId, ...copy(loss.context.firstFailure) });
    }
    issues.push(...deaths.values());
    const firstFailures = [...new Map(scarcity.map(row => [`${row.originId}:${row.regionId}:${row.at}`, row])).values()];
    for (const row of firstFailures) row.supplyEvidence = !row.inventory ? 'unrecorded'
      : row.inventory.regionalStock > 1e-8 || row.inventory.regionalAnimalMatterKg > 1e-8 ? 'regional-matter-present-access-or-compatibility-unresolved'
        : 'no-recorded-regional-stock-at-first-shortfall';
    result.coverage = { sourceId: source.id, from: source.calendar.epochAt, until: account.clock, cycleEnd,
      species, catalogRequired: options.requireCatalog === true, originalLocated: Object.values(originalCounts).reduce((n, v) => n + v, 0) };
    result.ecology = ecology; result.firstFailures = firstFailures; result.unresolved = unresolved;
    result.status = issues.length ? 'rejected' : account.clock < cycleEnd ? 'incomplete' : unresolved.length ? 'unverified' : 'supported';
    return result;
  }
  function runtimeSource(record, map) {
    validate(record, map);
    if (map.beastHabitatSources?.id !== record.id) throw Error('Active accounts require the exact archived original source');
    if (!record.physicalBinding) throw Error('Archived source lacks recorded physical bindings; activation cannot silently upgrade it');
    // Neither a positive nor a negative preliminary forecast is a measured
    // verdict. Native adoption is still unfinished even for a supported replay.
    throw Error('Original allocation remains diagnostic: measured seasonal viability and native adoption are required');
  }
  function replay(record, map, options = {}) {
    validate(record, map);
    if (map.beastHabitatSources?.id !== record.id) throw Error('Replay requires the exact archived original source');
    if (!record.physicalBinding) throw Error('Archived source lacks recorded physical bindings; replay cannot silently upgrade it');
    const P = typeof module === 'object' && module.exports ? require('./beast-populations') : globalThis.HelixBeastPopulations;
    if (!P) throw Error('Population account model must be loaded for a private source replay');
    const binding = options.binding || { worldId: `diagnostic-world:${record.sourceDigest}`, runId: `diagnostic-run:${record.id}` };
    const account = options.account ? P.normalize(options.account, binding) : P.createDiagnostic(expand(record, map), binding);
    if (!account || account.diagnosticOnly !== true || account.sourceId !== record.id) throw Error('Replay does not own the original diagnostic source/binding');
    const cycleEnd = record.calendar.epochAt + record.calendar.monthDays.reduce((n, d) => n + d, 0) * Journeys.DAY;
    const until = options.until ?? cycleEnd;
    if (!Number.isFinite(until) || until < account.clock) throw Error('Invalid elapsed replay endpoint');
    P.advance(account, until, true, true);
    const viability = assess(expand(record, map), map, { account, token: assessmentToken, requireCatalog: true });
    const issues = viability.issues;
    const work = {};
    for (const r of account.regions) for (const [action, amount] of Object.entries(r.ecologicalReceipts || {})) work[action] = (work[action] || 0) + amount;
    const audit = P.audit(account), counts = Object.values(audit).reduce((sum, row) => {
      for (const key of ['background', 'detailed', 'dead']) sum[key] += row[key]; return sum;
    }, { background: 0, detailed: 0, dead: 0 });
    const unresolved = ['Bounded physical contacts do not establish sustained all-species food-web/opposition viability or native source adoption'];
    const report = { diagnosticOnly: true, sourceId: record.id, until, cycleEnd,
      status: viability.status === 'supported' ? 'unverified' : viability.status,
      issues, unresolved, viability, work, counts, initialLocated: Object.values(account.originalCounts).reduce((n, v) => n + v, 0),
      born: account.births.reduce((n, b) => n + b.count, 0), populations: copy(record.populations), sourceAvailability: copy(record.physicalBinding.issues),
      foodWeb: P.foodWebSummary(account), backgroundWildlife: Wildlife.summary(account),
      boundaries: account.work.boundaries, cohortIntervals: account.work.cohortIntervals };
    return { account, report };
  }
  function attach(seed, map) {
    const next = World.validateStrategicMap(map);
    if (next.beastHabitatSources) throw Error('Original habitat sources already exist; do not overwrite an archived world');
    next.beastHabitatSources = generate(seed, next);
    return World.finalizeStrategicMap(next);
  }
  return { KINDS, STOCKS, ORIGINAL_COUNTS, cellAreaHa, compatible, usableHabitat, sourceDigest, expandPatch,
    expand, forecast, assess, generate, validate, runtimeSource, replay, attach, populationsFor };
});
