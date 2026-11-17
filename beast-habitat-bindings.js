// Archived physical allocations for generated habitats. No encounter authority.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./strategic-world') : root.HelixStrategicWorld,
    node ? require('./creature-biology') : root.HelixCreatureBiology,
    node ? require('./beast-bodies') : root.HelixBeastBodies,
    node ? require('./beast-regional-work') : root.HelixBeastRegionalWork);
  if (node) module.exports = api;
  root.HelixBeastHabitatBindings = api;
})(globalThis, function (World, Data, Bodies, Work) {
  'use strict';
  const EPS = 1e-8, copy = x => JSON.parse(JSON.stringify(x));
  const channels = Data.ledgers.map(([id]) => id), vector = n => Object.fromEntries(channels.map(k => [k, n]));
  const actionFor = Object.fromEntries(Object.entries(Work.actions).map(([action, species]) => [species, action]));
  function allocate(original, map, options = {}) {
    const source = copy(original), regions = new Map(source.regions.map(r => [r.id, r]));
    const binding = { basis: 'Original geography, finite material partitions and existing life histories',
      transfers: [], capacities: [], rainfallShares: [], workSites: [], nurseries: [], groupBindings: [], issues: [] };
    // Small uncharted ponds occupy a partition of this same catchment. Their
    // original 15 L/m² surface-water share is already in the raw pond account;
    // filling the deeper basin must debit its actual neighboring surface stock.
    for (const pond of source.regions.filter(r => r.source?.catchmentPond)) {
      const catchment = source.regions.find(r => r.cellId === pond.cellId && r.kind === 'surface');
      const amount = Math.max(0, pond.capacity.waterL - pond.stocks.waterL);
      if (!catchment || !(amount > 0) || catchment.stocks.waterL < amount) throw Error('Unfunded catchment pond');
      catchment.stocks.waterL -= amount; pond.stocks.waterL += amount;
      (binding.catchmentTransfers ||= []).push({ fromRegionId: catchment.id, toRegionId: pond.id, amount });
    }
    function transfer(r, from, to, amount, basis) {
      const n = Math.max(0, Math.min(r.stocks[from] || 0, amount));
      if (!(n > EPS)) return 0;
      r.stocks[from] -= n; r.stocks[to] = (r.stocks[to] || 0) + n;
      binding.transfers.push({ regionId: r.id, from, to, amount: n, basis }); return n;
    }
    function capacity(r, key, n) { binding.capacities.push({ regionId: r.id, key, amount: Math.max(r.stocks[key] || 0, n) }); }
    const groupsByRegion = new Map();
    const populationCounts = new Map();
    for (const g of source.groups) {
      populationCounts.set(g.populationId, (populationCounts.get(g.populationId) || 0) + g.cohorts.reduce((n, c) => n + c.count, 0));
      if (!groupsByRegion.has(g.regionId)) groupsByRegion.set(g.regionId, []);
      groupsByRegion.get(g.regionId).push(g);
    }
    const patchByCell = new Map();
    for (const r of source.regions) {
      if (!patchByCell.has(r.cellId)) patchByCell.set(r.cellId, []);
      patchByCell.get(r.cellId).push(r);
      transfer(r, 'mineralsKg', 'habitatMatrixKg', r.stocks.mineralsKg * .001,
        'Reserved original supporting substrate/dissolved nutrient matrix; not additional ore');
      if (r.kind === 'waterColumn') {
        transfer(r, 'mineralsKg', 'calciumKg', r.stocks.mineralsKg * .01, 'Calcium share of original dissolved marine salts');
        if (r.biome === 'h') {
          const reef = Math.min((r.stocks.organicKg || 0) * .001 * 5, r.stocks.calciumKg * .001 * 1.25);
          transfer(r, 'calciumKg', 'livingReefKg', reef * .8, 'Existing reef-shelf carbonate structure');
          transfer(r, 'organicKg', 'livingReefKg', reef * .2, 'Existing reef-shelf living organic share');
          capacity(r, 'livingReefKg', reef * 10);
        }
      } else if (r.kind !== 'subsurface') {
        if (r.floor && !['I', 'A'].includes(r.biome) && r.source.surfaceDeposit !== 'n')
          transfer(r, 'mineralsKg', 'rootBedKg', r.stocks.mineralsKg * .001, 'Original rootable weathered ground');
        if (r.kind === 'wetland')
          transfer(r, 'detritusKg', 'wetlandBedKg', (r.stocks.detritusKg || 0) * .01, 'Original wetland organic bed');
        const atmospheric = transfer(r, 'waterL', 'atmosphericWaterL', Math.min(r.stocks.waterL * .001, r.areaHa * 10000 * .1),
          'Initial catchment water partition into its local atmospheric inventory');
        if (atmospheric > 0) {
          capacity(r, 'atmosphericWaterL', r.areaHa * 10000 * .5);
          binding.rainfallShares.push({ regionId: r.id, fraction: .01 });
        }
        transfer(r, 'mineralsKg', 'constructionKg', r.stocks.mineralsKg * .001, 'Original loose construction stone, not refined metal');
        if (r.kind === 'surface' && ['B', 'F', 'Y', 'R', 'G', 'S'].includes(r.biome))
          transfer(r, 'detritusKg', 'fuelKg', (r.stocks.detritusKg || 0) * .001, 'Original dry combustible detritus');
      }
      if ((groupsByRegion.get(r.id) || []).some(g => g.speciesId === 'beast:gravebloom-elk') && r.kind !== 'waterColumn') {
        const bloom = transfer(r, 'forageKg', 'bloomKg', (r.stocks.forageKg || 0) * .0001,
          'Original bloom-bearing forage associated with existing Gravebloom originals');
        if (bloom > 0) capacity(r, 'bloomKg', bloom * 10);
      }
    }
    // A real downstream neighbor, not another patch sharing a preferred biome.
    // Only a finite local portion of rainfall becomes this outlet; accumulated
    // upstream runoff is not minted again at every strategic cell.
    const courseByRegion = new Map();
    for (const r of source.regions.filter(r => r.kind === 'wetland')) {
      const index = r.source.cellIndex, downstream = map.hydrology.downstreamByCell[index];
      if ((!options.established && map.hydrology.riverClasses[index] === '.') || downstream < 0) continue;
      const choices = patchByCell.get(World.cellId(downstream)) || [];
      const target = choices.find(p => p.kind === 'wetland') || choices.find(p => p.kind === 'waterColumn') || choices.find(p => p.kind === 'surface');
      if (!target || !r.edges.some(edge => edge.id === target.id)) {
        binding.issues.push({ kind: 'unboundWatercourse', regionId: r.id, downstreamCellId: World.cellId(downstream) }); continue;
      }
      const moved = transfer(r, 'waterL', 'flowWaterL', r.stocks.waterL * .01, 'Finite original river-water share of the wetland column');
      const flowPerDay = Math.min(...r.seasons.map(s => s.renewal.waterL || 0)) * .01;
      if (!(moved > 0 && flowPerDay > 0)) continue;
      const course = { id: `watercourse:${r.id}`, sourceKey: 'flowWaterL', downstreamRegionId: target.id, flowPerDay };
      courseByRegion.set(r.id, course); binding.rainfallShares.push({ regionId: r.id, flowFraction: .01 });
    }
    const nurseryAreaLeft = new Map(source.regions.map(r => [r.id, r.areaHa * .05]));
    for (const g of source.groups) {
      const r = regions.get(g.regionId), p = Data.lifecycle[g.speciesId], body = Bodies.profiles[g.speciesId];
      const members = g.cohorts.reduce((n, c) => n + c.count, 0), groupBinding = { groupId: g.id, instinct: copy(g.instinct),
        ...(populationCounts.get(g.populationId) > 128 ? { aggregateMortality: true } : {}) };
      const phases = r.seasons.map((s, i) => s.temperatureC >= p.minC && s.temperatureC <= p.maxC ? i : -1).filter(i => i >= 0);
      const footprintHa = body.lengthM * body.widthM / 10000;
      const mediumFits = r.kind !== 'waterColumn' && !['beast:mire-choir', 'beast:rivercoil'].includes(g.speciesId)
        || (r.stocks[r.kind === 'waterColumn' ? 'seawaterL' : 'waterL'] || 0) / (r.areaHa * 10000 * 1000) >= (body.minWaterDepthM || 0);
      const habitatSuitable = mediumFits && r.areaHa >= footprintHa && phases.length > 0;
      const action = actionFor[g.speciesId];
      if (g.speciesId === 'beast:thunderback-grazer' && habitatSuitable)
        groupBinding.ecology = { action: 'graze', regionId: r.id, effortFraction: 1 };
      if (g.speciesId === 'beast:brine-cathedral') groupBinding.feedingTowers = [100, 100, 100, 100];
      let workSite = null;
      if (action) {
        const site = { id: `work-site:${g.id}`, action, speciesId: g.speciesId, areaHa: r.areaHa,
          maxWorkers: Math.min(members, Math.floor(r.areaHa / Math.max(.000001, footprintHa))) };
        if (action === 'rootStabilize' && r.stocks.rootBedKg > 0) Object.assign(site, {
          rootable: true, substrateKey: 'rootBedKg', minSubstrateKg: Math.min(r.stocks.rootBedKg, Math.max(1, footprintHa * 100)), vitrifiedKg: 0 });
        else if (action === 'tendWetland' && r.stocks.wetlandBedKg > 0 || action === 'cultivateReef' && r.stocks.livingReefKg > 0
          || action === 'filterPlankton' && r.kind === 'waterColumn' || action === 'buildDam' && courseByRegion.has(r.id)) {
          site.water = { stockKey: r.kind === 'waterColumn' ? 'seawaterL' : 'waterL', areaM2: r.areaHa * 10000, minDepthM: body.minWaterDepthM || 0 };
          if (action === 'buildDam') Object.assign(site, { watercourseId: courseByRegion.get(r.id).id, damKg: 0,
            maxDamKg: Math.max(100, r.stocks.constructionKg || 0), retentionLPerKgDay: 10 });
        } else if (action === 'growBlooms' && r.stocks.bloomKg > 0) site.phases = phases;
        else if (action === 'buildFurnace' && r.kind === 'surface') Object.assign(site, {
          colonyId: `${g.id}:hive`, oxygen: r.oxygen, waterDepthM: 0, furnaceKg: 0, maxFurnaceKg: Math.max(.001, members * .00004) });
        else if (action === 'filterMana' && r.seasons.some(s => s.renewal.excessMana > 0)) site.medium = 'air';
        else {
          binding.issues.push({ kind: action === 'dreamWeather' ? 'unverifiedDreamParticipants' : 'missingPhysicalWorkSite', groupId: g.id, action, regionId: r.id });
          site.action = null;
        }
        if (site.action && habitatSuitable && site.maxWorkers > 0) {
          workSite = site; binding.workSites.push({ regionId: r.id, site });
          groupBinding.ecology = { action, siteId: site.id, regionId: r.id, effortFraction: 1 };
          if (action === 'buildFurnace') binding.issues.push({ kind: 'unverifiedOriginalFurnaceMetal', groupId: g.id, regionId: r.id });
        } else if (site.action) binding.issues.push({ kind: 'unsupportedPhysicalWorkMedium', groupId: g.id, regionId: r.id, action });
      }
      if (p.fertileDays != null && p.offspring > 0) {
        const slotAreaHa = Math.max(.000001, footprintHa * (p.newbornKg / p.adultKg) ** (2 / 3) * 4);
        const young = g.cohorts.filter(c => c.ageDays < p.independentDays).reduce((n, c) => n + c.count, 0);
        const propagation = p.massSource.startsWith('Partition') || /propagule/i.test(p.method);
        const breeders = g.cohorts.filter(c => (propagation || c.role === 'female' || c.role === 'queen')
          && c.ageDays >= Math.max(p.adultDays, p.fertileDays)).reduce((n, c) => n + c.count, 0);
        const desired = young + Math.max(1, breeders * p.offspring * 2);
        const reservedAreaHa = habitatSuitable ? Math.min(nurseryAreaLeft.get(r.id), desired * slotAreaHa) : 0;
        nurseryAreaLeft.set(r.id, nurseryAreaLeft.get(r.id) - reservedAreaHa);
        const capacity = habitatSuitable ? Math.max(0, Math.floor(reservedAreaHa / slotAreaHa + EPS)) : 0;
        const matureMale = g.cohorts.some(c => c.role === 'male' && c.count > 0 && c.ageDays >= p.fertileDays);
        const nursery = { id: `nursery:${g.id}`, speciesId: g.speciesId, capacity, reservedAreaHa, slotAreaHa,
          habitatSuitable, mateAccess: matureMale, phases,
          ...(options.positions && g.home?.patchId === r.id ? { position: { regionId: r.id, eastM: g.home.eastKm * 1000,
            northM: g.home.northKm * 1000, altitudeM: -g.home.depthM || 0 } } : {}),
          ...(g.speciesId === 'beast:ember-ant' ? { colonyId: `${g.id}:hive`, furnaceKg: 0,
            workSiteId: workSite?.id || null } : {}) };
        binding.nurseries.push({ regionId: r.id, nursery });
        groupBinding.initialNurseryId = nursery.id;
        groupBinding.breeding = { siteId: nursery.id, ...(p.reproductiveMana > 0 ? { manaStockKey: 'excessMana' } : {}),
          ...(p.foodKgDay === 0 && p.mineralsKgDay > 0 ? { growthRecipe: { mineralsKg: 1 }, birthRecipe: { mineralsKg: 1 } } : {}) };
        if (!capacity) binding.issues.push({ kind: 'unsupportedPhysicalNursery', groupId: g.id, regionId: r.id });
      }
      binding.groupBindings.push(groupBinding);
    }
    binding.watercourses = [...courseByRegion].map(([regionId, course]) => ({ regionId, course }));
    binding.environments = source.regions.map(r => ({ regionId: r.id, ...environment(r, map) }));
    if (options.established) establish(source, binding, map);
    if (options.drainage) {
      for (const row of binding.watercourses) {
        const r = regions.get(row.regionId), target = regions.get(row.course.downstreamRegionId);
        const edge = r.edges.find(e => e.id === target.id), i = r.source.cellIndex, j = target.source.cellIndex;
        const grade = Math.max(0, map.hydrology.flowSurfaceM[i] - map.hydrology.flowSurfaceM[j]) / (edge.distanceKm * 1000);
        // Explicit coarse channel geometry/calibration, independent of animals
        // or current rain demand. It cannot grant an outlet to a closed basin.
        row.course.outlet = { widthM: Math.min(100, Math.sqrt(r.areaHa * 10000) * .02),
          depthM: Math.min(2, r.depthM), velocityMps: Math.min(2, .05 + grade * 100), grade };
      }
      for (const row of binding.environments) if (row.ecology.floodable)
        row.ecology.floodplain = { areaHa: regions.get(row.regionId).areaHa, safeDepthMm: 100, erosionPointsPerMm: .01 };
    }
    return binding;
  }
  function establish(source, binding, map) {
    binding.establishedHabitats = true;
    binding.availability = []; binding.initialWork = []; binding.initialOutputs = [];
    const groups = new Map(source.groups.map(g => [g.id, g])), regions = new Map(source.regions.map(r => [r.id, r]));
    const original = new Map(binding.workSites.map(row => [row.site.id, row]));
    const shared = new Map(), workerDays = new Map();
    for (const g of source.groups) for (const c of g.cohorts)
      workerDays.set(c.id, c.count * Math.min(source.calendar.monthDays.at(-1), Math.max(0, c.ageDays - Data.lifecycle[g.speciesId].adultDays)));
    function stock(r, site, key) {
      if (!['constructionKg', 'metalKg', 'fuelKg'].includes(key)) return key;
      const local = `${site.id}:${key}`, amount = (r.stocks[key] || 0) * site.footprintHa / r.areaHa;
      r.stocks[key] = (r.stocks[key] || 0) - amount; r.stocks[local] = amount;
      binding.transfers.push({ regionId: r.id, from: key, to: local, amount,
        basis: 'Finite material share at the original physical work face; no ore-to-metal conversion' });
      binding.capacities.push({ regionId: r.id, key: local, amount });
      return local;
    }
    function feature(r, action, template) {
      const key = `${r.id}:${action}`; if (shared.has(key)) return shared.get(key);
      const body = Bodies.profiles[Work.actions[action]], id = `habitat-work:${key}`;
      const footprintHa = Math.min(1, r.areaHa * .01), radiusM = Math.sqrt(footprintHa * 10000 / Math.PI);
      const extent = Math.max(0, Math.sqrt(r.areaHa * 10000 / Math.PI) - radiusM);
      const roll = token => parseInt(World.stableHash(`${map.geology.digest}:${id}:${token}`), 16) / 4294967296;
      const angle = roll('angle') * 2 * Math.PI, distance = extent * .35 * Math.sqrt(roll('radius'));
      let point = { regionId: r.id, eastM: Math.cos(angle) * distance, northM: Math.sin(angle) * distance,
        altitudeM: ['waterColumn', 'wetland'].includes(r.kind) ? -Math.min(r.depthM - .1, body.heightM * 1.2) : 0 };
      const course = binding.watercourses.find(c => c.regionId === r.id);
      if (action === 'buildDam' && course) {
        const edge = r.edges.find(e => e.id === course.course.downstreamRegionId), exit = edge?.routeFrames?.exit || edge?.departurePosition;
        if (exit) {
          const length = Math.hypot(exit.eastM, exit.northM), scale = length > extent ? extent / length : 1;
          point = { ...point, eastM: exit.eastM * scale, northM: exit.northM * scale };
        }
      }
      const site = { ...copy(template), id, featureId: id, footprintHa, position: point,
        maxWorkers: Math.floor(footprintHa * 10000 / (body.lengthM * body.widthM)), inputKeys: {} };
      if (action === 'dreamWeather') { site.participantGroupIds = []; site.allowDormantParticipants = true; }
      for (const name of Object.keys(Work.spec(action).costs)) site.inputKeys[name] = stock(r, site, name);
      if (action === 'buildDam') site.maxDamKg = Math.min(1000, r.stocks[site.inputKeys.constructionKg] || 0);
      shared.set(key, { regionId: r.id, site }); return shared.get(key);
    }
    const retained = [];
    for (const gb of binding.groupBindings) {
      const g = groups.get(gb.groupId), r = regions.get(g.regionId), action = actionFor[g.speciesId];
      if (!action) continue;
      const old = gb.ecology && original.get(gb.ecology.siteId);
      if (!old && action !== 'dreamWeather') {
        binding.availability.push({ groupId: g.id, action, status: 'unavailable', reason: action === 'buildDam'
          ? 'No actual adjoining drainage outlet' : 'No compatible physical substrate or medium' });
        continue;
      }
      const phases = r.seasons.flatMap((s, i) => s.temperatureC >= Data.lifecycle[g.speciesId].minC
        && s.temperatureC <= Data.lifecycle[g.speciesId].maxC ? [i] : []);
      const template = old?.site || { action, speciesId: g.speciesId, areaHa: r.areaHa, phases };
      // A furnace belongs to one colony, not to every hive sharing the region.
      let row;
      if (action === 'buildFurnace') {
        const base = feature(r, action, template), site = { ...copy(base.site), id: `habitat-work:${g.id}`,
          featureId: base.site.featureId, colonyId: `${g.id}:hive`, maxWorkers: Math.min(base.site.maxWorkers, g.cohorts.reduce((n, c) => n + c.count, 0)) };
        // Each original colony has a disjoint face/material share. Do not copy
        // the first colony's stock account into every subsequent hive.
        const siblings = source.groups.filter(x => x.regionId === r.id && x.speciesId === g.speciesId).length;
        site.footprintHa /= siblings; site.maxWorkers = Math.floor(site.maxWorkers / siblings);
        site.inputKeys = {};
        for (const name of Object.keys(Work.spec(action).costs)) {
          const from = base.site.inputKeys[name], to = `${site.id}:${name}`;
          const amount = (binding.capacities.find(c => c.regionId === r.id && c.key === from)?.amount || 0) / siblings;
          r.stocks[from] = Math.max(0, r.stocks[from] - amount); r.stocks[to] = amount;
          binding.transfers.push({ regionId: r.id, from, to, amount, basis: 'Disjoint original colony workface allocation' });
          binding.capacities.push({ regionId: r.id, key: to, amount }); site.inputKeys[name] = to;
        }
        row = { regionId: r.id, site }; retained.push(row);
      } else row = feature(r, action, template);
      gb.ecology = { action, siteId: row.site.id, regionId: r.id, effortFraction: 1 };
      gb.home = { ...g.home, eastKm: row.site.position.eastM / 1000, northKm: row.site.position.northM / 1000,
        depthM: -row.site.position.altitudeM || 0 };
      const nursery = binding.nurseries.find(n => n.regionId === r.id && n.nursery.id === g.breeding?.siteId)
        || binding.nurseries.find(n => n.nursery.id === gb.breeding?.siteId);
      if (nursery) { nursery.nursery.position = copy(row.site.position); if (action === 'buildFurnace') nursery.nursery.workSiteId = row.site.id; }
      const localMetal = r.stocks[row.site.inputKeys.metalKg] || 0;
      binding.availability.push({ groupId: g.id, action, siteId: row.site.id,
        status: action === 'dreamWeather' || action === 'buildFurnace' && !localMetal ? 'dormant' : 'bound',
        ...(action === 'dreamWeather' ? { reason: 'No recorded present willing sleepers' }
          : action === 'buildFurnace' && !localMetal ? { reason: 'No recorded refined-metal stock; geological potential is not metal' } : {}) });
    }
    binding.workSites = [...shared.values()].filter(row => row.site.action !== 'buildFurnace').concat(retained);
    // Construction-only starting history. Do not credit hypothetical past
    // nurturing, rainfall, offspring or future mining/smelting capacity.
    for (const row of binding.workSites.filter(row => ['buildDam', 'buildFurnace'].includes(row.site.action))) {
      const { site } = row, r = regions.get(row.regionId), action = site.action, spec = Work.spec(action);
      const builders = binding.groupBindings.filter(g => g.ecology?.siteId === site.id).flatMap(gb => {
        const g = groups.get(gb.groupId); return g.cohorts.filter(c => action !== 'buildFurnace' || c.role === 'worker')
          .map(c => ({ g, c, days: workerDays.get(c.id) || 0 }));
      });
      const output = action === 'buildDam' ? 'damKg' : 'furnaceKg', limit = action === 'buildDam' ? site.maxDamKg : site.maxFurnaceKg;
      const life = Data.lifecycle[site.speciesId], previous = r.seasons.at(-1);
      if (previous.temperatureC < life.minC || previous.temperatureC > life.maxC) continue;
      const elapsedDays = Math.min(source.calendar.monthDays.at(-1), Math.max(0, ...builders.map(b => b.c.ageDays - life.adultDays)));
      let days = Math.min(builders.reduce((n, c) => n + c.days, 0), site.maxWorkers * elapsedDays, limit * .25 / spec.outputs[output]);
      const costs = { ...spec.costs }, g = builders[0]?.g;
      if (!g) continue;
      costs[g.resources.foodKg] = (costs[g.resources.foodKg] || 0) + life.foodKgDay;
      for (const [key, amount] of [['waterL', life.waterLDay], ['mineralsKg', life.mineralsKgDay], ['excessMana', life.manaDay], ['chargeMJ', life.otherDay]])
        if (amount > 0) costs[key] = (costs[key] || 0) + amount;
      for (const [key, cost] of Object.entries(costs)) if (cost > 0) days = Math.min(days, (r.stocks[site.inputKeys[key] || key] || 0) / cost);
      if (!(days > EPS)) continue;
      const inputs = {};
      for (const [key, cost] of Object.entries(costs)) {
        const actual = site.inputKeys[key] || key, amount = cost * days; if (!amount) continue;
        r.stocks[actual] -= amount; inputs[actual] = amount;
        binding.transfers.push({ regionId: r.id, from: actual, to: `history-spent:${site.id}:${key}`, amount, basis: 'Paid original construction and worker maintenance' });
      }
      // Transfer destinations remain audit-only until apply moves them into
      // the actual structure and recorded metabolic outputs below.
      const workers = []; let left = days;
      for (const b of builders) { const used = Math.min(left, b.days); if (used) workers.push({ cohortId: b.c.id, workerDays: used });
        workerDays.set(b.c.id, b.days - used); left -= used; }
      site[output] = (site[output] || 0) + spec.outputs[output] * days;
      site.historicalWorkerDays = (site.historicalWorkerDays || 0) + days;
      binding.initialWork.push({ regionId: r.id, siteId: site.id, action, fromDaysBeforeStart: elapsedDays, toDaysBeforeStart: 0,
        workerDays: days, workers, inputs,
        structure: { key: output, kg: spec.outputs[output] * days } });
      for (const [key, cost] of Object.entries(costs)) {
        const waste = (cost - (spec.costs[key] || 0)) * days;
        if (waste > 0) binding.initialOutputs.push({ regionId: r.id, key: `originalWorkWaste:${key}`, amount: waste });
      }
    }
    // Keep explicit unsupported inputs in availability. They are not evidence
    // that every optional ability must run continuously for a region to live.
    binding.issues = binding.issues.filter(i => !['missingPhysicalWorkSite', 'unverifiedOriginalFurnaceMetal', 'unverifiedDreamParticipants'].includes(i.kind));
    binding.issues.push(...binding.availability.filter(a => a.status !== 'bound').map(a => ({ ...a,
      kind: a.action === 'dreamWeather' ? 'dormantDreamWeather' : a.action === 'buildFurnace' ? 'unavailableOriginalFurnaceMetal' : 'unavailablePhysicalWorkSite',
      optionalWork: true })));
  }
  function environment(r, map) {
    const index = r.source.cellIndex, marine = r.kind === 'waterColumn', underground = r.kind === 'subsurface';
    const condition = { soilCover: marine || underground || r.biome === 'I' ? 0 : r.biome === 'D' ? 10 : 75,
      freshwaterQuantity: !marine && r.capacity.waterL > 0 ? 75 : 0, freshwaterQuality: !marine && r.capacity.waterL > 0 ? 75 : 0,
      wetlandReefHabitat: r.kind === 'wetland' || marine && r.biome === 'h' ? 75 : 0,
      renewableBiomass: r.capacity.forageKg > 0 || r.capacity.planktonKg > 0 ? 75 : 0,
      arcaneStability: map.arcaneGeography.arcaneStabilityPermille[index] / 10 };
    const seasonalEP = r.seasons.map(season => Object.fromEntries(channels.map((key, i) => [key, condition[key] > 0 ? season.renewalEP[i] : 0])));
    const shares = Object.fromEntries(channels.filter(k => seasonalEP.some(ep => ep[k] > 0)).map(k => [k, 1]));
    return { condition, seasonalEP, ecology: { referenceCondition: copy(condition),
      viabilityFloors: Object.fromEntries(Object.entries(condition).filter(([, n]) => n > 0).map(([k, n]) => [k, n * .4])),
      naturalRenewalEP: copy(seasonalEP[0]),
      renewalDependencies: { forageKg: ['soilCover', 'renewableBiomass'], organicKg: ['renewableBiomass'], detritusKg: ['renewableBiomass'],
        planktonKg: ['renewableBiomass'], waterL: ['freshwaterQuantity', 'freshwaterQuality'], excessMana: ['arcaneStability'] },
      workSites: [], renewalSites: [{ id: `natural-source:${r.id}`, materials: { habitatMatrixKg: r.stocks.habitatMatrixKg },
        renewalShares: Object.fromEntries(['forageKg', 'organicKg', 'detritusKg', 'planktonKg', 'waterL', 'excessMana']
          .filter(k => r.seasons.some(s => s.renewal[k] > 0)).map(k => [k, 1])), ledgerShares: shares }], floodable: r.kind === 'wetland' } };
  }
  function apply(source, binding, map) {
    const regions = new Map(source.regions.map(r => [r.id, r]));
    for (const t of binding.catchmentTransfers || []) {
      const from = regions.get(t.fromRegionId), to = regions.get(t.toRegionId);
      if (!from || !to || from.cellId !== to.cellId || from.kind !== 'surface' || !to.source?.catchmentPond
        || !(t.amount > 0) || !Number.isFinite(t.amount) || from.stocks.waterL + EPS < t.amount
        || to.stocks.waterL + t.amount > to.capacity.waterL + EPS) throw Error('Unfunded catchment pond');
      from.stocks.waterL = Math.max(0, from.stocks.waterL - t.amount); to.stocks.waterL += t.amount;
    }
    for (const t of binding.transfers) {
      const r = regions.get(t.regionId);
      if (!(t.amount >= 0) || !Number.isFinite(t.amount) || !((r.stocks[t.from] || 0) + EPS >= t.amount)) throw Error('Unfunded original habitat allocation');
      if (Object.hasOwn(r.stocks, t.from)) r.stocks[t.from] = Math.max(0, r.stocks[t.from] - t.amount);
      r.stocks[t.to] = (r.stocks[t.to] || 0) + t.amount;
      r.capacity[t.to] = Math.max(r.capacity[t.to] || 0, r.stocks[t.to]);
    }
    for (const c of binding.capacities) regions.get(c.regionId).capacity[c.key] = c.amount;
    if (binding.establishedHabitats) {
      for (const t of binding.transfers) if (t.to.startsWith('history-spent:')) {
        delete regions.get(t.regionId).stocks[t.to]; delete regions.get(t.regionId).capacity[t.to];
      }
      for (const output of binding.initialOutputs) {
        const r = regions.get(output.regionId); r.outputs ||= {}; r.outputs[output.key] = (r.outputs[output.key] || 0) + output.amount;
      }
    }
    for (const row of binding.rainfallShares) {
      const r = regions.get(row.regionId), key = row.flowFraction != null ? 'flowWaterL' : 'atmosphericWaterL', fraction = row.flowFraction ?? row.fraction;
      for (const season of r.seasons) { const n = season.renewal.waterL * fraction; season.renewal.waterL -= n; season.renewal[key] = (season.renewal[key] || 0) + n; }
    }
    for (const row of binding.environments) {
      const r = regions.get(row.regionId); r.condition = copy(row.condition);
      r.seasons.forEach((season, i) => { season.renewalEP = copy(row.seasonalEP[i]); });
      r.renewalPerDay = copy(r.seasons[0].renewal);
      r.ecology = copy(row.ecology);
      r.nurseries = [];
    }
    for (const { regionId, site } of binding.workSites) regions.get(regionId).ecology.workSites.push(copy(site));
    for (const { regionId, nursery } of binding.nurseries) regions.get(regionId).nurseries.push(copy(nursery));
    for (const { regionId, course } of binding.watercourses) regions.get(regionId).ecology.watercourses = [copy(course)];
    const groups = new Map(source.groups.map(g => [g.id, g]));
    for (const { groupId, feedingTowers, aggregateMortality, initialNurseryId, ...fields } of binding.groupBindings) {
      const g = groups.get(groupId); Object.assign(g, copy(fields));
      if (feedingTowers) for (const c of g.cohorts) c.feedingTowers = copy(feedingTowers);
      if (aggregateMortality) for (const c of g.cohorts) c.aggregateMortality = true;
      if (initialNurseryId) for (const c of g.cohorts) if (c.ageDays < Data.lifecycle[c.speciesId].independentDays) c.nurseryId = initialNurseryId;
    }
    source.physicalBinding = { basis: binding.basis, issues: copy(binding.issues),
      ...(binding.establishedHabitats ? { establishedHabitats: true, availability: copy(binding.availability), initialWork: copy(binding.initialWork) } : {}) };
    return source;
  }
  return { allocate, apply, channels, vector };
});
