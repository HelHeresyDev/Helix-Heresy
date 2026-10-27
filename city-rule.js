(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./city-provisioning') : root.HelixCityProvisioning);
  if (node) module.exports = api;
  if (root) root.HelixCityRule = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Provisioning) {
  'use strict';
  const DAY = 86400, INTERVAL = 3 * DAY;
  const ROLES = ['centralAdministration', 'civicReview', 'civilWatch', 'publicWorksAndProvisioning', 'militaryDefenseCommand'];
  const copy = x => JSON.parse(JSON.stringify(x));
  const finite = n => Number.isFinite(n) && n >= 0;
  const LIMITS = 'Three uninterrupted days of supported city operation, not neighboring sovereignty, divine endorsement or an ending. Independent courts, property and worship remain independent. Reports are dated personal receipts, never a live remote roster. Finite municipal allocations are not player or market goods.';
  function sourceFromWorld(map, cityId) {
    if (!map || !cityId) return null;
    const row = map?.strategicPlayableSettlementState?.cityRows?.find(r => r.cityId === cityId);
    const g = map?.cityGovernments?.governments?.find(r => r.cityId === cityId);
    const civic = map?.strategicCivicHistory?.currentInstitutionRows;
    const control = map?.strategicPoliticalHistory?.currentControlRows?.find(r => r.cityId === cityId);
    const sites = map?.strategicCapabilityHistory?.milestoneRows?.flatMap(m => m.infrastructureRows || []) || [];
    const works = sites.find(s => s.cityId === cityId && s.function === 'fortifiedWorks' && s.operationalAtPlayableYear);
    const power = sites.find(s => s.cityId === cityId && s.function === 'powerWorks' && s.operationalAtPlayableYear);
    if (!row?.physicalJurisdictionExists || row.currentPopulation < 8 || row.physicalCondition === 'ruined'
      || !g || !civic || !control || control.controlStatus !== 'sovereign' || !control.recognizedAuthorityId || !control.sovereignPolityId
      || control.effectiveControllerPolityId !== control.sovereignPolityId
      || !works || !power || !['functional', 'strong'].includes(row.services?.provisioning)
      || !['functional', 'strong'].includes(row.services?.fortifications)) return null;
    const institutions = ROLES.map(role => {
      const id = g.roleAssignments[role], original = g.institutions.find(i => i.id === id);
      const current = civic.find(i => i.institutionId === id);
      return original && current && current.actualControlStatus === 'localCharter'
        && !['displaced', 'disrupted', 'suspended'].includes(current.operationalStatus)
        ? { role, id } : null;
    });
    if (institutions.some(i => !i)) return null;
    const reserveDays = Math.min(...[works, power].map(s => ({ fragile: 2, strained: 3, serviceable: 4, robust: 5 })[s.hiddenConditionBand] || 0));
    const farms = Provisioning.sourceFromWorld(map, cityId, true);
    if (!reserveDays || !farms.length) return null;
    return { cityId, cityName: row.name, charterId: g.charter.id, populationSourceId: row.assetId,
      population: row.currentPopulation, institutions, worksId: works.id, powerId: power.id,
      powerCondition: ({ fragile: 65, strained: 75, serviceable: 85, robust: 100 })[power.hiddenConditionBand], reserveDays, farms,
      politicalSourceId: `${cityId}:playable-political-control`, baselineAuthorityId: control.recognizedAuthorityId,
      provenance: 'Existing populated city, original institutions, water/wall works, power works and measured direct agricultural routes; finite run-owned elaboration.' };
  }
  function validSource(s) {
    return Boolean(s && ['cityId', 'charterId', 'populationSourceId', 'worksId', 'powerId'].every(k => typeof s[k] === 'string' && s[k])
      && Number.isInteger(s.population) && s.population >= 8 && finite(s.reserveDays) && s.reserveDays >= 1 && s.reserveDays <= 5
      && (s.powerCondition == null || finite(s.powerCondition) && s.powerCondition <= 100)
      && ROLES.every(role => s.institutions?.some(i => i.role === role && i.id)) && Array.isArray(s.farms) && s.farms.length
      && new Set(s.farms.map(f => f.satelliteId)).size === s.farms.length
      && s.farms.every(f => Provisioning.validSource(f) && f.cityId === s.cityId && f.cityPopulation === s.population
        && f.populationSourceId === s.populationSourceId && f.charterId === s.charterId));
  }
  function create(source, succession, provision, defense, run, at) {
    if (!validSource(source) || !run?.worldId || !run.runId || !succession?.handover
      || succession.source.cityId !== source.cityId || succession.source.charterId !== source.charterId
      || (source.baselineAuthorityId && source.baselineAuthorityId !== succession.source.authority?.id)
      || !provision || !defense || [provision, defense].some(s => s.worldId !== run.worldId || s.runId !== run.runId
        || s.source.cityId !== source.cityId || s.handoverId !== succession.handover.id)
      || provision.source.cityPopulation !== source.population || provision.demand.population > source.population
      || !source.farms.some(f => f.satelliteId === provision.source.satelliteId)) return null;
    return allocate(source, succession, run, at, provision, defense.initialEnergy, defense.id);
  }
  function createAggregate(source, succession, run, at, reservedDefense) {
    if (!validSource(source) || !run?.worldId || !run.runId || !succession?.handover
      || succession.source.cityId !== source.cityId || succession.source.charterId !== source.charterId
      || source.baselineAuthorityId && source.baselineAuthorityId !== succession.source.authority?.id
      || !reservedDefense?.id || !finite(reservedDefense.initialEnergy)) return null;
    return allocate(source, succession, run, at, null, reservedDefense.initialEnergy, reservedDefense.id);
  }
  function allocate(source, succession, run, at, provision, excludedEnergy, defenseId) {
    const population = source.population - (provision?.demand.population || 0), dailyKg = population * .5;
    const farms = source.farms.map(f => {
      const pilot = f.satelliteId === provision?.source.satelliteId ? provision : null;
      // Farm residents feed themselves first. The detailed pilot's entire
      // allocated quota/crop/driver/truck is removed, not copied into this pool.
      const output = f.satellitePopulation * .5 * ({ marginal: 4, limited: 6, productive: 8, abundant: 10 })[f.arableLandBand];
      const exportKg = Math.max(0, output - f.satellitePopulation * .5 - (pilot?.demand.kgPerDay || 0));
      const drivers = Math.max(0, Math.floor(f.satellitePopulation / 100) - (pilot ? 1 : 0));
      const stock = exportKg * f.storageDays;
      return { id: f.satelliteId, distanceKm: f.distanceKm, drivers, capacityKg: drivers * 1200,
        fuelKm: drivers * 600, initialFuelKm: drivers * 600, spentFuelKm: 0, dutySeconds: drivers * 8 * 3600,
        stockKg: stock, initialKg: stock, cropKg: exportKg * 6, initialCropKg: exportKg * 6,
        harvestedKg: 0, deliveredKg: 0, cargoKg: 0, exportKg, trip: null, lastDepartureAt: null,
        excludedPilotId: pilot?.id || null, storageDays: f.storageDays };
    });
    const rate = Math.max(1, source.population / 1000);
    const energy = Math.max(0, source.reserveDays * DAY * rate - excludedEnergy);
    return { id: `${source.cityId}:city-operating-account`, worldId: run.worldId, runId: run.runId, source: copy(source),
      handoverId: succession.handover.id, officeId: succession.officeId, bodyEpoch: succession.handover.bodyEpoch,
      allocationMode: provision ? 'detailedPilot' : 'aggregate',
      pilotProvisionId: provision?.id || null, pilotDefenseId: defenseId, allocatedAt: at, lastAt: at,
      population, dailyKg, foodKg: dailyKg * 2, initialFoodKg: dailyKg * 2, eatenKg: 0, unmetKg: 0,
      waterLiters: source.population * 4, initialWaterLiters: source.population * 4, drankLiters: 0,
      rawWaterLiters: source.population * 12, initialRawWaterLiters: source.population * 12, pumpedLiters: 0, unmetLiters: 0,
      energy, initialEnergy: energy, chargedEnergy: 0, recharge: null, spentEnergy: 0, energyRate: rate, excludedDefenseEnergy: excludedEnergy, farms,
      operatorWorkSeconds: 8 * 3600, powerFuel: { stock: 0, capacity: 24, received: 0, processed: 0, enabled: false, progress: null },
      powerMaintenanceInitialized: true,
      powerMaintenance: { condition: source.powerCondition ?? 100, initialCondition: source.powerCondition ?? 100, operatedSeconds: 0, wear: 0, repaired: 0, initializedAt: at },
      plan: null, command: null, receipts: [], since: null, establishedAt: null, accomplishment: null,
      status: 'recognized', failureAt: null, report: null, nextNumber: 1 };
  }
  function normalize(s) {
    if (!validSource(s?.source) || !s.worldId || !s.runId || !s.handoverId || (!s.pilotProvisionId && s.allocationMode !== 'aggregate') || !s.pilotDefenseId
      || !['lastAt', 'foodKg', 'waterLiters', 'rawWaterLiters', 'energy', 'eatenKg', 'drankLiters', 'spentEnergy'].every(k => finite(s[k]))
      || !Array.isArray(s.farms) || !Array.isArray(s.receipts) || s.farms.length !== s.source.farms.length
      || s.farms.some(f => !['stockKg', 'cropKg', 'cargoKg', 'fuelKm', 'dutySeconds'].every(k => finite(f[k])))) return null;
    const next = copy(s);
    next.chargedEnergy ??= 0;
    // Legacy plants start from their surviving operational baseline NOW, not
    // from an invented overdue maintenance date or retroactive wear.
    if (!next.powerMaintenance) {
      const lost = next.powerMaintenanceInitialized === true, baseline = lost ? 50 : 100;
      next.powerMaintenance = { condition: baseline, initialCondition: baseline, operatedSeconds: 0, wear: 0, repaired: 0,
        initializedAt: next.lastAt, ...(lost ? { accountLost: true } : {}) };
    }
    next.powerMaintenanceInitialized = true;
    const maintenance = next.powerMaintenance;
    if (!['condition', 'initialCondition', 'operatedSeconds', 'wear', 'repaired', 'initializedAt'].every(k => finite(maintenance[k]))
      || maintenance.condition > 100 || maintenance.initialCondition > 100
      || Math.abs(maintenance.initialCondition - maintenance.wear + maintenance.repaired - maintenance.condition) > 1e-5) return null;
    next.powerFuel ||= { stock: 0, capacity: 24, received: 0, processed: 0, enabled: false, progress: null };
    const fuel = next.powerFuel;
    if (fuel.capacity !== 24 || !['stock', 'received', 'processed'].every(k => Number.isInteger(fuel[k]) && finite(fuel[k]))
      || fuel.stock + (fuel.progress ? 1 : 0) > fuel.capacity
      || fuel.progress && (!finite(fuel.progress.work) || fuel.progress.work > 60 || !fuel.progress.handoverId)) return null;
    return next;
  }
  function authority(s, succession, people, c) {
    return Boolean(s && c.sourceCurrent && c.bodyEpoch === s.bodyEpoch && succession?.handover?.id === s.handoverId
      && succession.control?.sourceReceiptId === s.handoverId && succession.control.recognizedAuthorityId === 'scientist'
      && succession.control.bodyEpoch === s.bodyEpoch && succession.source.cityId === s.source.cityId
      && succession.source.charterId === s.source.charterId && ROLES.every(role => {
        const institution = s.source.institutions.find(i => i.role === role);
        return succession.agreements?.some(r => r.institutionId === institution.id && r.roles.includes(role)
          && r.termsId === succession.handover.termsId && !r.suspendedRoles?.includes(role)
          && people.some(p => p.id === r.personId && p.status === 'alive' && p.health >= 50
            && !c.incapacitatedIds?.includes(p.id)
            && p.officeStatus?.status !== 'replacedByReviewedAppointment')
          && succession.control.commandRelationships?.some(a => a.personId === r.personId && a.institutionId === institution.id && a.roles.includes(role)));
      }));
  }
  const contact = c => c.alive && c.capable && c.atCounter && c.local && c.free && !c.violence && c.reportersPresent;
  const plantWorking = s => !s.powerMaintenance || !s.powerMaintenance.accountLost && !s.powerMaintenance.repairAssignment && s.powerMaintenance.condition > 50 + 1e-7;
  function order(s, succession, people, c, at) {
    if (!contact(c) || !authority(s, succession, people, c) || s.plan || s.command || s.recharge || s.operatorServiceAssignment || s.operatorWorkSeconds < 3600 || c.institutionsAvailable !== true) return false;
    s.command = { id: `${s.id}:operating-priority:${s.nextNumber++}`, at, progress: 0 };
    return true;
  }
  const owned = i => !i.cityOwnerId && !i.civicCustody && (!i.ownerId || i.ownerId === 'scientist') && (!i.legalOwnerId || i.legalOwnerId === 'scientist');
  function recharge(s, succession, people, c, stacks, at, quantity = 1) {
    if (!contact(c) || !authority(s, succession, people, c) || !c.institutionsAvailable || !plantWorking(s) || s.command || s.recharge || s.operatorServiceAssignment
      || !Number.isInteger(quantity) || quantity < 1 || s.operatorWorkSeconds < 60 * quantity
      || s.initialEnergy - s.energy < 21600 * quantity) return false;
    const item = stacks.find(i => i.key === 'arcaneFeedstock' && i.quantity >= quantity && i.carriedBy === 'scientist'
      && !i.reservedTaskId && !i.fixtureId && !i.containerId && !i.tags?.includes('contaminated') && owned(i));
    if (!item) return false;
    item.quantity -= quantity; item.knownQuantity = Math.min(item.knownQuantity ?? item.quantity, item.quantity);
    s.recharge = { id: `${s.id}:power-fuel:${s.nextNumber++}`, at, progress: 0, stackId: item.id, quantity,
      powerWorksId: s.source.powerId, handoverId: s.handoverId };
    return true;
  }
  function stationCurrent(s, c) {
    const d = c.defenseAccount;
    return Boolean(s.allocationMode !== 'aggregate' && c.defenseStationPresent && d && d.id === s.pilotDefenseId
      && d.worldId === s.worldId && d.runId === s.runId && d.handoverId === s.handoverId
      && d.source.cityId === s.source.cityId && finite(d.energy) && finite(d.initialEnergy) && !d.refusal);
  }
  function distribution(s, succession, people, c, enabled, at) {
    if (!contact(c) || !authority(s, succession, people, c) || !stationCurrent(s, c)) return false;
    s.distribution = enabled ? { at, handoverId: s.handoverId, stationId: s.pilotDefenseId, powerId: s.source.powerId, progress: 0 } : null;
    return true;
  }
  function condition(s, succession, people, c) {
    if (!c.sourceCurrent || c.coverageVerified !== true) return 'unverified';
    if (!authority(s, succession, people, c) || !c.institutionsAvailable) return 'authority';
    if (!['noEstablishedChallenge', 'capableOpposition'].includes(c.counterpower)) return 'unverified';
    if (c.counterpower === 'capableOpposition') return 'contested';
    if (!s.plan || !s.receipts.length) return 'commands';
    if ((s.foodKg <= 1e-7 && s.dailyKg > 0) || s.waterLiters <= 1e-7 || s.allocationMode !== 'aggregate' && !c.pilotSupplied) return 'supply';
    if (s.energy <= 1e-7 || !c.defenseAvailable || s.allocationMode !== 'aggregate' && !c.pilotDefended) return 'defense';
    return null;
  }
  function assess(s, succession, people, c, at) {
    const reason = condition(s, succession, people, c);
    if (reason === 'unverified') { s.status = 'unverified'; s.since = null; s.establishedAt = null; return; }
    if (reason) {
      if (s.since != null) s.failureAt = at;
      s.since = null; s.establishedAt = null;
      s.status = s.accomplishment || ['contested', 'authority', 'supply', 'defense'].includes(reason) ? 'contested'
        : s.command || s.plan ? 'limited' : 'recognized';
      return;
    }
    s.since ??= at;
    s.status = at - s.since >= INTERVAL ? 'established' : 'limited';
    if (s.status === 'established') {
      s.establishedAt ??= s.since + INTERVAL;
      s.accomplishment ||= { at: s.establishedAt, sourceId: s.id, cityId: s.source.cityId, since: s.since };
    }
  }
  function advance(s, succession, people, context, at) {
    if (!s || !Number.isFinite(at) || at < s.lastAt) return false;
    let c = context(); if (!c.alive) return false;
    // Minute slices plus exact depletion, delivery, command and qualification
    // boundaries make coarse catch-up agree with ordinary heartbeat updates.
    assess(s, succession, people, c, s.lastAt);
    while (s.lastAt < at) {
      c = context(); if (!c.alive) break;
      const start = s.lastAt, foodRate = s.dailyKg / DAY, waterRate = s.source.population * 2 / DAY;
      let dt = Math.min(60, at - start);
      const plantAtStart = plantWorking(s);
      if (s.powerMaintenance && plantAtStart && s.plan && s.energy > 0)
        dt = Math.min(dt, (s.powerMaintenance.condition - 50) * 21600);
      // Stored fuel is an actual sixty-second workpiece. Preserve its exact
      // start/completion and energy-depletion ordering on large catch-up too.
      if (s.powerFuel?.enabled && (s.powerFuel.stock || s.powerFuel.progress)) dt = Math.min(dt, 1);
      for (const t of [s.foodKg > 1e-7 && foodRate ? s.foodKg / foodRate : Infinity,
        s.waterLiters > 1e-7 ? s.waterLiters / waterRate : Infinity,
        s.energy > 1e-7 ? s.energy / s.energyRate : Infinity,
        s.command ? 3600 - s.command.progress : Infinity,
        s.recharge ? 60 * s.recharge.quantity - s.recharge.progress : Infinity,
        s.since != null && start < s.since + INTERVAL ? s.since + INTERVAL - start : Infinity,
        ...s.farms.flatMap(f => [f.trip ? f.trip.dueAt - start : Infinity,
          f.lastDepartureAt != null ? f.lastDepartureAt + DAY - start : Infinity])]) if (t > 1e-7) dt = Math.min(dt, t);
      const end = start + dt, operative = authority(s, succession, people, c) && c.institutionsAvailable;
      const operatingAtStart = Boolean(s.plan);
      let workUsed = 0;
      if (s.powerMaintenance && plantAtStart && operatingAtStart && operative && s.energy > 0) {
        const wear = dt / 21600; s.powerMaintenance.operatedSeconds += dt;
        s.powerMaintenance.condition -= wear; s.powerMaintenance.wear += wear;
      }
      // Existing wards consume a finite original municipal power allocation.
      // It excludes every unit already assigned to the detailed outer station.
      const spent = Math.min(s.energy, dt * s.energyRate); s.energy -= spent; s.spentEnergy += spent;
      const food = Math.min(s.foodKg, dt * foodRate); s.foodKg = Math.max(0, s.foodKg - food);
      s.eatenKg += food; s.unmetKg += dt * foodRate - food;
      const water = Math.min(s.waterLiters, dt * waterRate); s.waterLiters = Math.max(0, s.waterLiters - water);
      s.drankLiters += water; s.unmetLiters += dt * waterRate - water;
      if (s.command && operative && !s.operatorServiceAssignment) {
        const work = Math.min(dt, s.operatorWorkSeconds); s.operatorWorkSeconds -= work; s.command.progress += work;
        workUsed += work;
        if (s.command.progress >= 3600) {
          s.plan = { at: end, sourceId: s.command.id };
          s.receipts.push({ id: s.command.id, at: end, kind: 'operatingPriority', workSeconds: 3600 }); s.command = null;
        }
      } else if (s.command && !operative) s.command = null; // No refund or signature-only completion.
      if (s.recharge && operative && plantAtStart && !s.operatorServiceAssignment && s.recharge.handoverId === s.handoverId && s.recharge.powerWorksId === s.source.powerId) {
        const work = Math.min(dt - workUsed, s.operatorWorkSeconds); s.operatorWorkSeconds -= work; s.recharge.progress += work;
        workUsed += work;
        if (s.recharge.progress >= 60 * s.recharge.quantity) {
          const amount = Math.min(21600 * s.recharge.quantity, Math.max(0, s.initialEnergy - s.energy)); s.energy += amount;
          s.chargedEnergy = (s.chargedEnergy || 0) + amount;
          s.receipts.push({ id: s.recharge.id, at: end, kind: 'existingPowerWorksFuel', stackId: s.recharge.stackId,
            quantity: s.recharge.quantity, energy: amount, workSeconds: 60 * s.recharge.quantity, powerWorksId: s.source.powerId }); s.recharge = null;
        }
      }
      const distribution = s.distribution;
      if (distribution && operative && plantAtStart && stationCurrent(s, c) && distribution.handoverId === s.handoverId
        && distribution.powerId === s.source.powerId && distribution.stationId === s.pilotDefenseId
        && !s.command && !s.recharge && !s.operatorServiceAssignment && c.defenseAccount.energy < 21600 && s.energy >= 21600) {
        const work = Math.min(dt - workUsed, s.operatorWorkSeconds, 60 - distribution.progress);
        s.operatorWorkSeconds -= work; distribution.progress += work; workUsed += work;
        if (distribution.progress >= 60) {
          const amount = Math.min(21600, c.defenseAccount.initialEnergy - c.defenseAccount.energy);
          s.energy -= amount; s.transferredEnergy = (s.transferredEnergy || 0) + amount;
          c.defenseAccount.energy += amount;
          c.defenseAccount.municipalEnergyReceived = (c.defenseAccount.municipalEnergyReceived || 0) + amount;
          s.receipts.push({ id: `${s.id}:distribution:${s.nextNumber++}`, at: end, kind: 'existingStationTransfer',
            stationId: s.pilotDefenseId, powerWorksId: s.source.powerId, energy: amount, workSeconds: 60 });
          distribution.progress = 0;
        }
      }
      const fuel = s.powerFuel;
      if (fuel?.enabled && fuel.handoverId === s.handoverId && operative && plantAtStart && s.plan && !s.operatorServiceAssignment && !s.command && !s.recharge) {
        if (!fuel.progress && fuel.stock >= 1 && s.initialEnergy - s.energy >= 21600) {
          fuel.stock--; fuel.progress = { work: 0, handoverId: s.handoverId, at: end };
        }
        if (fuel.progress && fuel.progress.handoverId === s.handoverId && fuel.progress.at < end) {
          const work = Math.min(dt - workUsed, s.operatorWorkSeconds, 60 - fuel.progress.work);
          s.operatorWorkSeconds -= work; workUsed += work; fuel.progress.work += work;
          if (fuel.progress.work >= 60) {
            const energy = Math.min(21600, Math.max(0, s.initialEnergy - s.energy));
            s.energy += energy; s.chargedEnergy += energy; fuel.processed++;
            s.receipts.push({ id: `${s.id}:stored-fuel:${s.nextNumber++}`, at: end, kind: 'municipalStoredPowerFuel', quantity: 1,
              energy, powerWorksId: s.source.powerId, workSeconds: 60 }); fuel.progress = null;
          }
        }
      }
      if (workUsed > 0) s.operatorWorkedUntil = end;
      if (operatingAtStart && operative && plantAtStart && s.energy > 0) {
        const pumped = Math.min(s.rawWaterLiters, Math.max(0, s.source.population * 4 - s.waterLiters), dt * waterRate * 2);
        s.rawWaterLiters -= pumped; s.pumpedLiters += pumped; s.waterLiters += pumped;
      }
      for (const f of s.farms) {
        const source = s.source.farms.find(a => a.satelliteId === f.id), route = c.routes?.[f.id];
        const crossings = (c.armedRouteCrossings?.[f.id] || []).filter(km => km > 0 && km < f.distanceKm);
        if (operatingAtStart && operative && source.productionAvailable !== false && (route !== false || c.armedRouteHolds?.includes(f.id))) {
          const harvest = Math.min(f.cropKg, dt * f.exportKg / DAY, Math.max(0, f.exportKg * f.storageDays - f.stockKg));
          f.cropKg -= harvest; f.harvestedKg += harvest; f.stockKg += harvest;
        }
        if (f.trip && (route !== false || crossings.length)) {
          // The same aggregate convoy travels to the actual occupied crossing.
          // A team arriving behind it cannot stop it remotely; inbound passage
          // is a separate encounter after the original farm handling time.
          const handling = Math.ceil(f.cargoKg / (50 * f.drivers)) * 30;
          const stop = crossings.flatMap(km => [km / 40 * 3600, (2 * f.distanceKm - km) / 40 * 3600 + handling])
            .filter(t => t >= f.trip.progress - 1e-7).sort((a, b) => a - b)[0] ?? Infinity;
          f.trip.progress = Math.min(f.trip.progress + dt, stop);
          if (f.trip.progress + 1e-7 >= f.trip.seconds) {
            s.foodKg += f.cargoKg; f.deliveredKg += f.cargoKg;
            s.receipts.push({ id: `${s.id}:delivery:${s.nextNumber++}`, at: end, kind: 'grainDelivered', farmId: f.id, kg: f.cargoKg });
            f.cargoKg = 0; f.trip = null;
          } else f.trip.dueAt = end + f.trip.seconds - f.trip.progress;
        } else if (f.trip) f.trip.dueAt = end + f.trip.seconds - f.trip.progress;
        if (!f.trip && s.plan && operative && (route !== false || crossings.length) && f.drivers && s.foodKg > 0 && s.waterLiters > 0
          && (f.lastDepartureAt == null || end - f.lastDepartureAt >= DAY)) {
          const kg = Math.floor((Math.min(f.stockKg, f.capacityKg, Math.max(0, s.dailyKg * 3 - s.foodKg)) + 1e-7) / 50) * 50;
          const seconds = 2 * f.distanceKm / 40 * 3600 + 2 * Math.ceil(kg / (50 * f.drivers)) * 30;
          const fuel = 2 * f.distanceKm * f.drivers;
          if (kg > 0 && seconds <= 8 * 3600 && f.fuelKm >= fuel && f.dutySeconds >= seconds * f.drivers) {
            f.stockKg = Math.max(0, f.stockKg - kg); f.cargoKg = kg; f.fuelKm -= fuel; f.spentFuelKm += fuel;
            f.dutySeconds -= seconds * f.drivers; f.lastDepartureAt = end;
            f.trip = { seconds, progress: 0, dueAt: end + seconds };
          }
        }
        // A supported sixteen-hour off-duty period can restore at most one
        // eight-hour shift; no health, fuel, goods or personal mana regeneration.
        if (!f.trip && s.foodKg > 0 && s.waterLiters > 0 && f.lastDepartureAt != null
          && end - f.lastDepartureAt >= DAY) f.dutySeconds = Math.min(f.drivers * 8 * 3600, f.dutySeconds + dt * f.drivers / 2);
      }
      s.lastAt = end; assess(s, succession, people, context(), end);
    }
    s.receipts = s.receipts.slice(-100);
    return true;
  }
  function receive(s, succession, people, c, at) {
    if (!contact(c)) return false;
    // No ticking or new authority is granted by reception. Report only what
    // these original present officials can substantiate in their own account.
    s.report = { at, sourceId: s.id, cityId: s.source.cityId, population: s.source.population,
      status: authority(s, succession, people, c) ? s.status : 'contested', since: s.since,
      establishedAt: s.establishedAt, accomplishment: copy(s.accomplishment),
      foodKg: s.foodKg, waterLiters: s.waterLiters, energy: s.energy,
      pendingDeliveries: s.farms.filter(f => f.trip).map(f => ({ farmId: f.id, dispatchedAt: f.lastDepartureAt,
        expectedKg: f.cargoKg, nominalReturnAt: f.lastDepartureAt + f.trip.seconds,
        overdue: at > f.lastDepartureAt + f.trip.seconds,
        scope: 'Local dispatch/receipt ledger only; no current carrier position, unseen cause or attacker identity.' })),
      excludedProvisionId: s.pilotProvisionId, excludedDefenseId: s.pilotDefenseId,
      receipts: copy(s.receipts), counterpower: c.counterpower === 'capableOpposition' ? 'An established effective challenge prevents verification.'
        : c.counterpower !== 'noEstablishedChallenge' ? 'Unverified: current coverage is incomplete.'
          : 'No established capable challenge within this operating account; not proof of universal loyalty or divine acquiescence.' };
    if (s.powerFuel) s.report.powerFuel = copy(s.powerFuel);
    if (s.powerMaintenance) s.report.powerMaintenance = copy(s.powerMaintenance);
    return true;
  }
  return { DAY, INTERVAL, ROLES, LIMITS, sourceFromWorld, validSource, create, createAggregate, normalize, authority, contact, plantWorking, condition, order, recharge, distribution, advance, receive };
});
