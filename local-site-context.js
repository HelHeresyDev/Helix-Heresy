(function initLocalSiteContext(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const planetaryRelief = typeof module === "object" && module.exports ? require("./planetary-relief") : root?.HelixPlanetaryRelief;
  const climateHydrologyBiomes = typeof module === "object" && module.exports ? require("./climate-hydrology-biomes") : root?.HelixClimateHydrologyBiomes;
  const strategicGeology = typeof module === "object" && module.exports ? require("./strategic-geology") : root?.HelixStrategicGeology;
  const strategicArcaneGeography = typeof module === "object" && module.exports ? require("./strategic-arcane-geography") : root?.HelixStrategicArcaneGeography;
  const api = factory(strategicWorld, planetaryRelief, climateHydrologyBiomes, strategicGeology, strategicArcaneGeography);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixLocalSiteContext = api;
})(typeof window !== "undefined" ? window : globalThis, function createLocalSiteContextApi(StrategicWorld, PlanetaryRelief, ClimateHydrologyBiomes, StrategicGeology, StrategicArcaneGeography) {
  "use strict";

  if (!StrategicWorld || !PlanetaryRelief || !ClimateHydrologyBiomes || !StrategicGeology || !StrategicArcaneGeography) {
    throw new Error("Strategic world, relief, environment, geology, and arcane geography must load before local-site-context.js");
  }

  const PHASES = Object.freeze([
    Object.freeze({ id: "thaw", label: "Thaw", temperatureFactor: -0.08, humidityFactor: 0.1 }),
    Object.freeze({ id: "highSun", label: "High Sun", temperatureFactor: 0.42, humidityFactor: -0.12 }),
    Object.freeze({ id: "stormturn", label: "Stormturn", temperatureFactor: 0.08, humidityFactor: 0.16 }),
    Object.freeze({ id: "deepCold", label: "Deep Cold", temperatureFactor: -0.42, humidityFactor: 0.02 })
  ]);
  const SECONDS_PER_DAY = 86400;
  const PHASE_DAYS = 30;
  const QUALITY = Object.freeze(["veryLow", "low", "moderate", "high", "veryHigh"]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function round(value, places = 1) { const scale = 10 ** places; return Math.round(Number(value) * scale) / scale; }
  function coreWithoutDigest(value) { const copy = clone(value); delete copy.digest; return copy; }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function label(value) { return String(value?.label || value?.name || value || "Unknown"); }
  function qualityFromPermille(value) { return QUALITY[clamp(Math.floor((Number(value) || 0) / 200), 0, 4)]; }

  function waterAccess(runSeed, site, environment, geologyInputs) {
    const band = site.distanceBand;
    const permeability = Number(geologyInputs.permeabilityPermille) || 0;
    const surfaceWater = Boolean(environment.lakeId || environment.riverClass?.id && environment.riverClass.id !== "none" || environment.wetlandClass?.id && environment.wetlandClass.id !== "none");
    const wetEnough = Number(environment.precipitationMm) >= 550 || surfaceWater;
    let kind = "hauledCistern";
    if (band === "cityDistrict") kind = "municipalMain";
    else if (band === "protectedApproaches") kind = permeability >= 420 ? "licensedWell" : "extendedMunicipalMain";
    else if (permeability >= 560 && wetEnough) kind = "protectedWell";
    else if (wetEnough) kind = "rainCatchmentAndCistern";
    const definitions = {
      municipalMain: { label: "Municipal main and inherited cistern", reliabilityBand: "high", replenishmentPerHour: 10, quality: 88, initialUnits: 105, capacityBand: "high" },
      extendedMunicipalMain: { label: "Extended municipal service and cistern", reliabilityBand: "moderate", replenishmentPerHour: 6, quality: 84, initialUnits: 100, capacityBand: "moderate" },
      licensedWell: { label: "Licensed well and inherited cistern", reliabilityBand: "moderate", replenishmentPerHour: 5, quality: 80, initialUnits: 96, capacityBand: "moderate" },
      protectedWell: { label: "Protected well and inherited cistern", reliabilityBand: "low", replenishmentPerHour: 3, quality: 76, initialUnits: 92, capacityBand: "low" },
      rainCatchmentAndCistern: { label: "Rain catchment, deliveries, and cistern", reliabilityBand: "low", replenishmentPerHour: 0.75, quality: 72, initialUnits: 90, capacityBand: "low" },
      hauledCistern: { label: "Hauled water and inherited cistern", reliabilityBand: "veryLow", replenishmentPerHour: 0, quality: 78, initialUnits: 100, capacityBand: "veryLow" }
    };
    const selected = definitions[kind];
    const qualityVariation = Math.round((seededNumber(runSeed, "water-quality") - 0.5) * 8);
    return {
      kind,
      label: selected.label,
      viableAtRunStart: true,
      reliabilityBand: selected.reliabilityBand,
      capacityBand: selected.capacityBand,
      replenishmentPerHour: selected.replenishmentPerHour,
      initialCisternUnits: selected.initialUnits,
      startingQuality: clamp(selected.quality + qualityVariation, 50, 100),
      surfaceWaterNearby: surfaceWater,
      haulingRequiredForReplenishment: kind === "hauledCistern",
      publicBasis: [environment.watershedId ? `watershed:${environment.watershedId}` : "no mapped watershed", `permeability:${qualityFromPermille(permeability)}`, `precipitation:${Math.round(environment.precipitationMm)}mm`]
    };
  }

  function utilityAccess(site, water) {
    const byBand = {
      cityDistrict: { accessKind: "municipalService", reliabilityBand: "high", multipliers: { air: 1, drain: 1, electricity: 1.1, mana: 1 } },
      protectedApproaches: { accessKind: "extendedService", reliabilityBand: "moderate", multipliers: { air: 0.85, drain: 0.75, electricity: 0.8, mana: 0.7 } },
      corridorFringe: { accessKind: "corridorMicrogrid", reliabilityBand: "low", multipliers: { air: 0.65, drain: 0.45, electricity: 0.55, mana: 0.5 } },
      remoteWilderness: { accessKind: "isolatedLocalPlant", reliabilityBand: "veryLow", multipliers: { air: 0.4, drain: 0.25, electricity: 0.35, mana: 0.4 } }
    };
    const result = clone(byBand[site.distanceBand] || byBand.remoteWilderness);
    result.waterAccessKind = water.kind;
    result.networkServiceIsPhysical = true;
    result.internetCreatesNoUtilityCapacity = true;
    return result;
  }

  function createLocalSiteContext(world, materializedSite, runSeed) {
    const map = world?.generatedData?.strategicMap;
    const site = materializedSite?.strategicLocation;
    if (!world?.canonicalDigest || !map || !site?.strategicCellId || materializedSite.canonicalWorldDigest !== world.canonicalDigest) throw new Error("Local site context requires a selected site in its unchanged canonical world.");
    const index = StrategicWorld.cellIndex(site.strategicCellId);
    const cell = StrategicWorld.cellSnapshot(map, index);
    if (!cell || cell.surfaceClass !== "land") throw new Error("Local site context requires a valid land cell.");
    const relief = PlanetaryRelief.cellReliefSnapshot(map, index);
    const environment = ClimateHydrologyBiomes.cellEnvironmentSnapshot(map, index);
    const geology = StrategicGeology.cellGeologySnapshot(map, index);
    const geologyInputs = StrategicGeology.localGeologyContext(map, index);
    const arcane = StrategicArcaneGeography.cellArcaneSnapshot(map, index);
    const arcaneInputs = StrategicArcaneGeography.localArcaneContext(map, index);
    if (!relief || !environment || !geology || !geologyInputs || !arcane || !arcaneInputs) throw new Error("The selected site lacks required strategic physical context.");
    const seed = String(runSeed || "local-site");
    const calendarOffsetDays = Math.floor(seededNumber(seed, "calendar-offset") * PHASES.length * PHASE_DAYS);
    const localVariation = {
      parcelTemperatureOffsetC: round((seededNumber(seed, "parcel-temperature") - 0.5) * 2.4),
      soilDepthM: round(0.4 + seededNumber(seed, "soil-depth") * (geology.surfaceDeposit?.id === "exposedBedrock" ? 1.2 : 4.8)),
      drainageIndex: Math.round(clamp((1000 - geologyInputs.permeabilityPermille) * 0.45 + (1000 - clamp(environment.aridityIndex * 500, 0, 1000)) * 0.25 + seededNumber(seed, "parcel-drainage") * 300, 0, 1000)),
      parcelManaOffset: Math.round((seededNumber(seed, "parcel-mana") - 0.5) * 8)
    };
    const water = waterAccess(seed, site, environment, geologyInputs);
    const context = {
      id: `local-context:${world.id}:${site.id}`,
      worldId: world.id,
      canonicalWorldDigest: world.canonicalDigest,
      runSeedDigest: `run-seed-${StrategicWorld.stableHash(seed)}`,
      candidateId: site.id,
      strategicCellId: site.strategicCellId,
      scenarioId: materializedSite.scenarioId,
      derivationPolicy: "worldPhysicalTruthPlusRunOwnedParcelVariation",
      reusableWorldUnchanged: true,
      calendar: { phaseDays: PHASE_DAYS, startOffsetDays: calendarOffsetDays, phases: PHASES.map(({ id, label: phaseLabel }) => ({ id, label: phaseLabel })) },
      location: { latitude: cell.latitude, longitude: cell.longitude, elevationM: relief.elevationM, slopePercent: relief.slopePercent, reliefClass: clone(relief.reliefClass), coastClass: clone(relief.coastClass), distanceBand: site.distanceBand, nearestSettlement: clone(site.nearestSettlement), routeContinuity: site.access.routeContinuity, jurisdiction: clone(site.jurisdiction) },
      environment: { meanTemperatureC: environment.temperatureC, seasonalRangeC: environment.seasonalRangeC, precipitationMm: environment.precipitationMm, aridityIndex: environment.aridityIndex, snowIcePercent: environment.snowIcePercent, windBearingDeg: environment.windBearingDeg, windStrengthPercent: environment.windStrengthPercent, biome: clone(environment.biomeClass), biomeModifiers: clone(environment.biomeModifiers), watershedId: environment.watershedId, watershedTerminalType: environment.watershedTerminalType, river: clone(environment.riverClass), wetland: clone(environment.wetlandClass), lakeId: environment.lakeId, lakeKind: environment.lakeKind },
      publicGeology: { provinceId: geology.provinceId, crustClass: clone(geology.crustClass), bedrockClass: clone(geology.bedrockClass), surfaceDeposit: clone(geology.surfaceDeposit), tectonicRegime: clone(geology.tectonicRegime), crustAgeMyr: geology.crustAgeMyr, permeabilityBand: geology.permeabilityBand, stabilityBand: geology.stabilityBand, geothermalBand: geology.geothermalBand, dominantHazard: clone(geology.dominantHazard), hazardBands: clone(geology.hazardBands) },
      geologyInputs: clone(geologyInputs),
      publicArcane: clone(arcane),
      arcaneInputs: clone(arcaneInputs),
      localVariation,
      water,
      utilities: utilityAccess(site, water),
      knowledge: { inheritedPropertySurvey: true, ordinaryClimateRecords: true, visibleSurfaceConditions: true, exposedBedrockKnown: true, exactDepositLocationsKnown: false, hiddenAquiferQualityKnown: false, concealedHazardsKnown: false },
      sourceFacts: { strategicMapDigest: map.digest, reliefDigest: map.relief.digest, environmentDigests: [map.climate.digest, map.hydrology.digest, map.biomes.digest], geologyDigests: [map.geology.digest, map.naturalHazards.digest], arcaneDigests: [map.arcaneGeography.digest, map.magicalHazards.digest], startingSiteCatalogDigest: map.publicStartingSiteDirectory?.digest || null }
    };
    context.digest = `local-site-context-${StrategicWorld.stableHash(coreWithoutDigest(context))}`;
    validateLocalSiteContext(context, { world, materializedSite });
    return context;
  }

  function validateLocalSiteContext(context, options = {}) {
    if (!context || context.digest !== `local-site-context-${StrategicWorld.stableHash(coreWithoutDigest(context))}`) throw new Error("Local site context digest is invalid.");
    if (!context.reusableWorldUnchanged || context.knowledge.exactDepositLocationsKnown || context.knowledge.hiddenAquiferQualityKnown || context.knowledge.concealedHazardsKnown) throw new Error("Local site knowledge violates the hidden-information boundary.");
    if (!context.water.viableAtRunStart || context.water.startingQuality < 50 || context.water.initialCisternUnits <= 0) throw new Error("A starting site lacks viable water.");
    if (options.world && (context.worldId !== options.world.id || context.canonicalWorldDigest !== options.world.canonicalDigest)) throw new Error("Local site context references a different canonical world.");
    if (options.materializedSite && context.candidateId !== options.materializedSite.strategicLocation?.id) throw new Error("Local context references a different candidate site.");
    return clone(context);
  }

  function phaseAt(context, clock = 0) {
    const absoluteDay = Number(context?.calendar?.startOffsetDays || 0) + Math.max(0, Number(clock) || 0) / SECONDS_PER_DAY;
    const phaseIndex = Math.floor(absoluteDay / PHASE_DAYS) % PHASES.length;
    const latitude = Number(context?.location?.latitude) || 0;
    const reversed = latitude < 0;
    const resolvedIndex = reversed ? (phaseIndex + 2) % PHASES.length : phaseIndex;
    const phase = PHASES[resolvedIndex];
    return { id: phase.id, label: phase.label, index: resolvedIndex, day: Math.floor(absoluteDay % PHASE_DAYS) + 1, hemisphereReversed: reversed };
  }

  function surfaceAmbient(context, clock = 0) {
    if (!context) return { temperatureC: 12, humidity: 45, manaDensity: 24, phase: { id: "unknown", label: "Unknown", day: 1 } };
    const phase = phaseAt(context, clock);
    const phaseDef = PHASES.find((entry) => entry.id === phase.id) || PHASES[0];
    const hour = ((Math.max(0, Number(clock) || 0) / 3600) % 24 + 24) % 24;
    const diurnal = Math.sin((hour - 8) / 24 * Math.PI * 2) * Math.min(6, Math.max(1.5, Number(context.environment.seasonalRangeC) * 0.18));
    const temperatureC = Number(context.environment.meanTemperatureC) + Number(context.localVariation.parcelTemperatureOffsetC) + Number(context.environment.seasonalRangeC) * phaseDef.temperatureFactor + diurnal;
    const baseHumidity = 78 - clamp(Number(context.environment.aridityIndex) * 42, 0, 55) + (context.environment.wetland?.id && context.environment.wetland.id !== "none" ? 8 : 0);
    const humidity = clamp(baseHumidity + phaseDef.humidityFactor * 35 - diurnal * 1.2, 12, 98);
    const manaDensity = clamp(Number(context.arcaneInputs.manaPermille) / 10 + Number(context.localVariation.parcelManaOffset), 0, 100);
    return { temperatureC: round(temperatureC), humidity: round(humidity), manaDensity: round(manaDensity), phase };
  }

  function undergroundAmbient(context) {
    if (!context) return { temperatureC: 15, humidity: 48, manaDensity: 30 };
    const geothermal = Number(context.geologyInputs.geothermalPermille) || 0;
    const permeability = Number(context.geologyInputs.permeabilityPermille) || 0;
    return {
      temperatureC: round(Number(context.environment.meanTemperatureC) * 0.45 + 8.5 + geothermal / 250),
      humidity: round(clamp(38 + permeability / 24 + (context.environment.wetland?.id && context.environment.wetland.id !== "none" ? 8 : 0), 25, 88)),
      manaDensity: round(clamp(Number(context.arcaneInputs.manaPermille) / 10 + Number(context.localVariation.parcelManaOffset) * 0.5 + 5, 0, 100))
    };
  }

  return Object.freeze({ PHASES, PHASE_DAYS, createLocalSiteContext, validateLocalSiteContext, phaseAt, surfaceAmbient, undergroundAmbient, clone });
});
