(function initStrategicCapabilityHistory(root, factory) {
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const resourcePotential = typeof module === "object" && module.exports ? require("./strategic-resource-potential") : root?.HelixStrategicResourcePotential;
  const cityExpansion = typeof module === "object" && module.exports ? require("./strategic-city-expansion") : root?.HelixStrategicCityExpansion;
  const api = factory(strategicWorld, resourcePotential, cityExpansion);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCapabilityHistory = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCapabilityHistoryApi(StrategicWorld, StrategicResourcePotential, StrategicCityExpansion) {
  "use strict";

  if (!StrategicWorld || !StrategicResourcePotential || !StrategicCityExpansion) throw new Error("Strategic world, resource, and city-expansion modules must load before strategic-capability-history.js");

  const ERA_DEFINITIONS = Object.freeze([
    Object.freeze({ id: "civicFortification", label: "Civic Fortification", summary: "Pre-urban magic and metalworking become durable walls, wards, waterworks, roads, and defended support sites." }),
    Object.freeze({ id: "arcaneIndustrial", label: "Arcane-Industrial", summary: "Standard power, chemical processing, precision fabrication, and maintainable production institutions emerge." }),
    Object.freeze({ id: "aerial", label: "Aerial", summary: "Flying mounts and aircraft extend patrol, rescue, and urgent transport without making bulk long-range logistics dependable." }),
    Object.freeze({ id: "mechanized", label: "Mechanized", summary: "Mechs, automation, advanced medicine, and holographic interfaces become practical but locally dependent systems." }),
    Object.freeze({ id: "globalData", label: "Global Data", summary: "Interoperable relay protocols make knowledge globally addressable while physical authority and material support remain local." }),
    Object.freeze({ id: "orbitalArcane", label: "Orbital-Arcane", summary: "Rockets, orbital sites, and a satellite constellation reinforced by magical relay links sustain the global internet." })
  ]);

  const CAPABILITY_DEFINITIONS = Object.freeze([
    capability("fortifiedCivicWorks", "Fortified Civic Works", "civicFortification", [], ["constructionStone", "ferrousOre", "manaCrystals"], "wardedLocalPower", ["wardEngineering", "civilConstruction", "waterAndRoadWorks"], ["fortifiedWorks"], "universalCity", 0.01),
    capability("standardManaPower", "Standard Mana and Power Systems", "arcaneIndustrial", ["fortifiedCivicWorks"], ["baseMetalOre", "manaCrystals", "geothermalEnergy"], "standardizedManaElectricalGrid", ["powerEngineering", "safetyStandards", "gridMaintenance"], ["powerWorks"], "universalCity", 0.17),
    capability("industrialFabrication", "Arcane-Industrial Fabrication", "arcaneIndustrial", ["standardManaPower"], ["ferrousOre", "baseMetalOre", "industrialMinerals", "chemicalFeedstock"], "industrialGridConnection", ["precisionManufacturing", "chemicalIndustry", "partsStandardization"], ["industrialWorks"], "componentHub", 0.28),
    capability("flyingMountInfrastructure", "Flying-Mount Infrastructure", "aerial", ["fortifiedCivicWorks"], ["biologicalProductivity", "timberFiber", "manaCrystals"], "wardedAerieAndCareSystems", ["aerialHusbandry", "mountTraining", "aerieMaintenance"], ["flyingMountAerie"], "componentHub", 0.36),
    capability("poweredAircraft", "Powered Aircraft", "aerial", ["industrialFabrication", "standardManaPower"], ["baseMetalOre", "chemicalFeedstock", "manaCrystals"], "highDensityPropulsionPower", ["aeronautics", "flightControl", "airframeMaintenance"], ["airfield"], "componentHub", 0.45),
    capability("mechanizedFrames", "Mechanized Frames", "mechanized", ["industrialFabrication", "poweredAircraft"], ["ferrousOre", "baseMetalOre", "manaCrystals", "industrialMinerals"], "highLoadManaElectricalGrid", ["mechEngineering", "controlSystems", "heavyMaintenance"], ["mechWorks"], "selectiveCity", 0.56),
    capability("holographicSystems", "Holographic Systems", "mechanized", ["standardManaPower", "industrialFabrication"], ["baseMetalOre", "manaCrystals", "industrialMinerals"], "stableLocalPowerAndMana", ["projectionEngineering", "interfaceStandards", "opticalMaintenance"], ["holographicExchange"], "universalCity", 0.64),
    capability("regionalDataRelays", "Regional Data Relays", "globalData", ["holographicSystems"], ["baseMetalOre", "manaCrystals", "industrialMinerals"], "continuousGatewayPower", ["relayEngineering", "identityProtocols", "networkMaintenance"], ["regionalRelayHub"], "componentHub", 0.71),
    capability("globalDataProtocols", "Global Data Protocols", "globalData", ["regionalDataRelays"], ["manaCrystals", "nullstone", "industrialMinerals"], "interoperablePoweredRelays", ["protocolStandards", "authentication", "crossCityOperations"], ["globalGateway"], "componentGateway", 0.78),
    capability("rocketSpaceflight", "Rocket Spaceflight", "orbitalArcane", ["poweredAircraft", "mechanizedFrames", "globalDataProtocols"], ["chemicalFeedstock", "baseMetalOre", "industrialMinerals", "manaCrystals"], "launchScalePowerAndPropulsion", ["launchEngineering", "orbitalNavigation", "rangeSafety"], ["rocketLaunchComplex"], "globalRare", 0.86),
    capability("orbitalArcaneRelayMesh", "Orbital-Arcane Relay Mesh", "orbitalArcane", ["rocketSpaceflight", "globalDataProtocols"], ["baseMetalOre", "manaCrystals", "nullstone", "industrialMinerals"], "orbitalAndGroundRelayPower", ["satelliteFabrication", "arcaneRelayOperations", "replacementLaunches"], ["orbitalControlGateway"], "componentGateway", 0.92),
    capability("individualSpaceflight", "Individual Spaceflight", "orbitalArcane", ["rocketSpaceflight"], ["manaCrystals"], "exceptionalInnatePhysicalMagicalOrDivinePower", ["spaceflightObservation", "survivalMedicine", "trajectoryCoordination"], ["spacefarerObservationCenter"], "phenomenon", 0.96)
  ]);
  const CAPABILITY_BY_ID = Object.freeze(Object.fromEntries(CAPABILITY_DEFINITIONS.map((definition) => [definition.id, definition])));
  const FAILURE_CONSEQUENCES = Object.freeze(["sealedPrototypeRuin", "contaminatedIndustrialSite", "lostLaunchRange", "abandonedRelayStation", "standardsSchism"]);
  const FAILURE_CAUSES = Object.freeze(["maintenanceCollapse", "resourceSubstitution", "institutionalSabotage", "beastAttack", "manaCascade"]);

  const INTERNET_BASELINE = Object.freeze({
    architecture: "orbitalSatelliteConstellationWithArcaneRelayMesh",
    globalAddressability: true,
    orbitalSatellites: true,
    arcaneRelayLinks: true,
    localGatewaysAndPowerRequired: true,
    disruptionPossible: true,
    createsPhysicalAuthority: false
  });
  const SPACEFLIGHT_BASELINE = Object.freeze({
    rocketSpaceflight: true,
    individuallyPoweredSpaceflight: true,
    orbitalInfrastructure: true,
    routineSurfaceFreightBySpaceflight: false,
    offWorldLogistics: "costlySpecializedAndCapacityLimited",
    orbitalTravelSimulationDeferred: true
  });

  function capability(id, label, eraId, prerequisiteIds, resourceFamilyIds, energyRequirement, institutionRoles, siteFunctions, deploymentScope, chronologyFraction) {
    return Object.freeze({ id, label, eraId, prerequisiteIds: Object.freeze(prerequisiteIds), resourceFamilyIds: Object.freeze(resourceFamilyIds), energyRequirement, institutionRoles: Object.freeze(institutionRoles), siteFunctions: Object.freeze(siteFunctions), deploymentScope, chronologyFraction });
  }

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function integerBetween(seed, channel, minimum, maximum) { return minimum + Math.floor(seededNumber(seed, channel) * (maximum - minimum + 1)); }
  function publicCore(directory) { const core = clone(directory); delete core.digest; return core; }
  function historyCore(record) { const core = clone(record); delete core.digest; return core; }

  function cityRows(map) {
    return StrategicCityExpansion.allCitySeeds(map).map((city) => ({
      id: city.cityId,
      name: city.cityName,
      cellId: city.cellId,
      foundingYear: city.foundingYear,
      independentRefuge: city.independentRefuge
    })).sort((left, right) => left.foundingYear - right.foundingYear || left.id.localeCompare(right.id));
  }

  function resourceScore(map, city, definition) {
    const index = StrategicWorld.cellIndex(city.cellId);
    return definition.resourceFamilyIds.reduce((total, familyId) => total + map.resourcePotential.potentialPermille[familyId][index], 0) / Math.max(1, definition.resourceFamilyIds.length);
  }

  function supportComponentFor(map, cityId) {
    return map.cityExpansionHistory.currentSupportComponents.find((component) => component.cityIds.includes(cityId)) || null;
  }

  function sourceCityFor(seed, map, cities, definition, discoveryYear) {
    const eligible = cities.filter((city) => city.foundingYear <= discoveryYear);
    return eligible.sort((left, right) => resourceScore(map, right, definition) - resourceScore(map, left, definition)
      || seededNumber(seed, `source:${definition.id}:${left.id}`) - seededNumber(seed, `source:${definition.id}:${right.id}`)
      || left.id.localeCompare(right.id))[0] || cities[0];
  }

  function deploymentCities(seed, map, cities, definition, sourceCity) {
    const components = map.cityExpansionHistory.currentSupportComponents;
    const ranked = [...cities].sort((left, right) => resourceScore(map, right, definition) - resourceScore(map, left, definition)
      || seededNumber(seed, `deployment:${definition.id}:${left.id}`) - seededNumber(seed, `deployment:${definition.id}:${right.id}`)
      || left.id.localeCompare(right.id));
    if (definition.deploymentScope === "universalCity") return [...cities];
    if (["componentHub", "componentGateway"].includes(definition.deploymentScope)) {
      return components.map((component) => ranked.find((city) => component.cityIds.includes(city.id))).filter(Boolean);
    }
    if (definition.deploymentScope === "selectiveCity") return ranked.slice(0, Math.max(components.length, Math.ceil(cities.length * 0.46)));
    if (definition.deploymentScope === "globalRare") return ranked.slice(0, Math.min(3, Math.max(1, Math.ceil(cities.length / 14))));
    if (definition.deploymentScope === "phenomenon") return [sourceCity];
    return [sourceCity];
  }

  function publicAccount(definition, sourceCity) {
    const limitation = definition.id === "globalDataProtocols" || definition.id === "orbitalArcaneRelayMesh"
      ? "The system carries information, not sovereign authority or dependable material support."
      : definition.id === "poweredAircraft" || definition.id === "flyingMountInfrastructure"
        ? "It improves urgent movement without making long-range bulk logistics routine."
        : definition.id === "individualSpaceflight"
          ? "The feat remains limited to rare beings whose own power can survive and cross space."
          : "Deployment remains dependent on local power, expertise, defended sites, and maintenance.";
    return `${sourceCity.name} produced the first retained demonstration. ${limitation}`;
  }

  function createStrategicCapabilityHistory(worldSeed, map, options = {}) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for strategic capability history.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityExpansion.validateCityExpansionHistory(strategicMap);
    if (strategicMap.humanGeography) throw new Error("Capability history must be generated before playable-year human geography.");
    const horizonYear = Math.max(strategicMap.cityExpansionHistory.historicalHorizonYear, Math.floor(Number(options.historicalHorizonYear) || 0));
    const cities = cityRows(strategicMap);
    const firstEraEnd = strategicMap.civilizationOrigins.eraEndYear;
    const span = Math.max(120, horizonYear - firstEraEnd);
    const milestoneRows = [];
    for (const [ordinal, definition] of CAPABILITY_DEFINITIONS.entries()) {
      const dependencyYear = Math.max(0, ...definition.prerequisiteIds.map((id) => milestoneRows.find((row) => row.capabilityId === id).standardizationYear));
      const proposedYear = definition.id === "fortifiedCivicWorks" ? 0 : firstEraEnd + Math.round(span * definition.chronologyFraction);
      const discoveryYear = Math.min(horizonYear - 4, Math.max(dependencyYear + (definition.id === "fortifiedCivicWorks" ? 0 : 2), proposedYear));
      const prototypeYear = Math.min(horizonYear - 2, discoveryYear + integerBetween(seed, `prototype-delay:${definition.id}`, 1, Math.max(1, Math.min(8, Math.floor(span / 18)))));
      const standardizationYear = Math.min(horizonYear, Math.max(prototypeYear + 1, prototypeYear + integerBetween(seed, `standardization-delay:${definition.id}`, 1, Math.max(1, Math.min(12, Math.floor(span / 14))))));
      const sourceCity = sourceCityFor(seed, strategicMap, cities, definition, discoveryYear);
      const deployedCities = deploymentCities(seed, strategicMap, cities, definition, sourceCity);
      const institution = {
        id: `capability-institution:${definition.id}:${sourceCity.id}`,
        name: `${sourceCity.name} ${definition.label} Institute`,
        sourceCityId: sourceCity.id,
        foundedYear: Math.max(sourceCity.foundingYear, discoveryYear - integerBetween(seed, `institution-lead:${definition.id}`, 0, 5)),
        roles: clone(definition.institutionRoles),
        sovereignAuthority: false
      };
      const infrastructureRows = deployedCities.map((city, siteOrdinal) => {
        const earliest = Math.max(standardizationYear, city.foundingYear + 1);
        const deploymentYear = Math.min(horizonYear, earliest + integerBetween(seed, `site-delay:${definition.id}:${city.id}`, 0, Math.max(1, Math.floor((horizonYear - earliest) * 0.35))));
        return {
          id: `capability-site:${definition.id}:${city.id}`,
          capabilityId: definition.id,
          cityId: city.id,
          cellId: city.cellId,
          function: definition.siteFunctions[siteOrdinal % definition.siteFunctions.length],
          commissionedYear: deploymentYear,
          operatingInstitutionId: institution.id,
          operationalAtPlayableYear: true,
          maintenanceRequirements: [definition.energyRequirement, ...definition.institutionRoles.slice(0, 2)],
          hiddenConditionBand: ["fragile", "strained", "serviceable", "robust"][integerBetween(seed, `hidden-condition:${definition.id}:${city.id}`, 0, 3)],
          hiddenSinglePointOfFailure: definition.deploymentScope === "globalRare" || (definition.deploymentScope === "componentGateway" && siteOrdinal === 0)
        };
      });
      const componentAdoptionRows = strategicMap.cityExpansionHistory.currentSupportComponents.map((component) => {
        const sites = infrastructureRows.filter((site) => component.cityIds.includes(site.cityId));
        const knowledgeYear = definition.id === "globalDataProtocols" || definition.chronologyFraction >= CAPABILITY_BY_ID.globalDataProtocols.chronologyFraction
          ? Math.min(horizonYear, standardizationYear + 1)
          : Math.min(horizonYear, standardizationYear + integerBetween(seed, `knowledge:${definition.id}:${component.id}`, 1, 18));
        return {
          supportComponentId: component.id,
          knowledgeYear,
          firstDeploymentYear: sites.length ? Math.min(...sites.map((site) => site.commissionedYear)) : null,
          deployedCityIds: sites.map((site) => site.cityId).sort(),
          knowsCapabilityAtPlayableYear: true,
          locallyDeploysAtPlayableYear: sites.length > 0
        };
      });
      milestoneRows.push({
        id: `capability-milestone:${String(ordinal + 1).padStart(2, "0")}`,
        capabilityId: definition.id,
        eraId: definition.eraId,
        discoveryYear,
        prototypeYear,
        standardizationYear,
        sourceCityId: sourceCity.id,
        prerequisiteIds: clone(definition.prerequisiteIds),
        resourceRequirementRows: definition.resourceFamilyIds.map((familyId) => [familyId, Math.round(resourceScore(strategicMap, sourceCity, { resourceFamilyIds: [familyId] }))]),
        energyRequirement: definition.energyRequirement,
        institution,
        infrastructureRows,
        componentAdoptionRows,
        publicAccount: publicAccount(definition, sourceCity)
      });
    }

    const failureCapabilityIds = ["poweredAircraft", "mechanizedFrames", "orbitalArcaneRelayMesh"];
    const failedProgramRows = failureCapabilityIds.map((capabilityId, ordinal) => {
      const milestone = milestoneRows.find((row) => row.capabilityId === capabilityId);
      const city = cities[(integerBetween(seed, `failure-city:${capabilityId}`, 0, cities.length - 1) + ordinal) % cities.length];
      const consequence = FAILURE_CONSEQUENCES[integerBetween(seed, `failure-consequence:${capabilityId}`, 0, FAILURE_CONSEQUENCES.length - 1)];
      return {
        id: `capability-failure:${String(ordinal + 1).padStart(2, "0")}`,
        capabilityId,
        year: Math.max(milestone.discoveryYear, Math.min(milestone.standardizationYear, milestone.prototypeYear)),
        cityId: city.id,
        cellId: city.cellId,
        actualCause: FAILURE_CAUSES[integerBetween(seed, `failure-cause:${capabilityId}`, 0, FAILURE_CAUSES.length - 1)],
        retainedConsequence: { kind: consequence, siteId: `failed-capability-site:${capabilityId}:${city.id}`, discoverable: true },
        publicExplanation: `A failed ${CAPABILITY_BY_ID[capabilityId].label.toLowerCase()} program left a ${consequence.replace(/([a-z])([A-Z])/g, "$1 $2")} at ${city.name}; later work proceeded through other maintained institutions.`
      };
    }).sort((left, right) => left.year - right.year || left.id.localeCompare(right.id));

    const eraRows = ERA_DEFINITIONS.map((era, ordinal) => {
      const milestones = milestoneRows.filter((row) => row.eraId === era.id);
      return { id: era.id, label: era.label, summary: era.summary, startYear: Math.min(...milestones.map((row) => row.discoveryYear)), endYear: ordinal === ERA_DEFINITIONS.length - 1 ? horizonYear : Math.max(...milestones.map((row) => row.standardizationYear)), capabilityIds: milestones.map((row) => row.capabilityId) };
    });
    const cityProfiles = cities.map((city) => ({
      city: { id: city.id, name: city.name, cellId: city.cellId },
      supportComponentId: supportComponentFor(strategicMap, city.id)?.id || null,
      allStandardizedCapabilitiesKnown: true,
      deployedCapabilityIds: milestoneRows.filter((milestone) => milestone.infrastructureRows.some((site) => site.cityId === city.id)).map((milestone) => milestone.capabilityId)
    }));
    const publicMilestones = milestoneRows.map((milestone) => {
      const definition = CAPABILITY_BY_ID[milestone.capabilityId];
      const sourceCity = cities.find((city) => city.id === milestone.sourceCityId);
      return {
        id: milestone.id,
        kind: "capabilityMilestone",
        capability: { id: definition.id, label: definition.label },
        eraId: definition.eraId,
        discoveryYear: milestone.discoveryYear,
        prototypeYear: milestone.prototypeYear,
        standardizationYear: milestone.standardizationYear,
        sourceCity: { id: sourceCity.id, name: sourceCity.name, cellId: sourceCity.cellId },
        prerequisites: clone(definition.prerequisiteIds),
        resourceRequirements: definition.resourceFamilyIds.map((familyId) => clone(StrategicResourcePotential.RESOURCE_BY_ID[familyId])),
        energyRequirement: definition.energyRequirement,
        institution: { id: milestone.institution.id, name: milestone.institution.name, sourceCityId: milestone.institution.sourceCityId, foundedYear: milestone.institution.foundedYear, roles: clone(milestone.institution.roles), sovereignAuthority: false },
        infrastructureSites: milestone.infrastructureRows.map((site) => ({ id: site.id, cityId: site.cityId, cityName: cities.find((city) => city.id === site.cityId).name, cellId: site.cellId, function: site.function, commissionedYear: site.commissionedYear, operationalAtPlayableYear: site.operationalAtPlayableYear, maintenanceRequirements: clone(site.maintenanceRequirements) })),
        adoption: { supportComponentCount: milestone.componentAdoptionRows.filter((row) => row.locallyDeploysAtPlayableYear).length, totalSupportComponentCount: strategicMap.cityExpansionHistory.currentSupportComponents.length, deployedCityCount: milestone.infrastructureRows.length, knowledgeIsGlobalAtPlayableYear: milestone.componentAdoptionRows.every((row) => row.knowsCapabilityAtPlayableYear), deploymentIsUneven: milestone.infrastructureRows.length < cities.length },
        publicAccount: milestone.publicAccount
      };
    });
    const publicFailures = failedProgramRows.map((failure) => ({ id: failure.id, kind: "capabilityFailure", capability: { id: failure.capabilityId, label: CAPABILITY_BY_ID[failure.capabilityId].label }, year: failure.year, city: { id: failure.cityId, name: cities.find((city) => city.id === failure.cityId).name, cellId: failure.cellId }, retainedConsequence: clone(failure.retainedConsequence), publicExplanation: failure.publicExplanation }));
    const publicDirectory = {
      historicalHorizonYear: horizonYear,
      eras: eraRows,
      milestoneRows: publicMilestones.map((milestone) => ({
        capabilityId: milestone.capability.id,
        discoveryYear: milestone.discoveryYear,
        prototypeYear: milestone.prototypeYear,
        standardizationYear: milestone.standardizationYear,
        sourceCityId: milestone.sourceCity.id,
        institution: clone(milestone.institution),
        infrastructureRows: milestone.infrastructureSites.map((site) => [site.cityId, site.function, site.commissionedYear]),
        adoption: clone(milestone.adoption),
        publicAccount: milestone.publicAccount
      })),
      failureRows: publicFailures,
      cityProfileRows: cityProfiles.map((profile) => [profile.city.id, profile.supportComponentId, clone(profile.deployedCapabilityIds)]),
      currentBaseline: {
        aircraftAndFlyingMountsExist: true,
        mechsExist: true,
        holographicSystemsExist: true,
        internet: clone(INTERNET_BASELINE),
        spaceflight: clone(SPACEFLIGHT_BASELINE),
        knowledgeDoesNotCreateMaterialSupport: true,
        everySupportComponentHasOrbitalGateway: milestoneRows.find((row) => row.capabilityId === "orbitalArcaneRelayMesh").componentAdoptionRows.every((row) => row.locallyDeploysAtPlayableYear)
      }
    };
    publicDirectory.digest = `public-capability-history-${StrategicWorld.stableHash(publicCore(publicDirectory))}`;
    const record = {
      sourceCityExpansionDigest: strategicMap.cityExpansionHistory.digest,
      sourceResourcePotentialDigest: strategicMap.resourcePotential.digest,
      historicalHorizonYear: horizonYear,
      milestoneRows,
      failedProgramRows,
      publicDirectoryDigest: publicDirectory.digest,
      diagnostics: {
        eraCount: eraRows.length,
        capabilityCount: milestoneRows.length,
        infrastructureSiteCount: milestoneRows.reduce((total, row) => total + row.infrastructureRows.length, 0),
        retainedFailureCount: failedProgramRows.length,
        supportComponentCount: strategicMap.cityExpansionHistory.currentSupportComponents.length,
        orbitalGatewayComponentCount: milestoneRows.find((row) => row.capabilityId === "orbitalArcaneRelayMesh").componentAdoptionRows.filter((row) => row.locallyDeploysAtPlayableYear).length,
        rocketLaunchSiteCount: milestoneRows.find((row) => row.capabilityId === "rocketSpaceflight").infrastructureRows.length
      }
    };
    record.digest = `capability-history-${StrategicWorld.stableHash(historyCore(record))}`;
    return { strategicCapabilityHistory: record, publicDirectory };
  }

  function publicCapabilityHistory(map) {
    const compact = map?.publicCapabilityHistory;
    if (!compact) return null;
    const cities = cityRows(map);
    const cityById = new Map(cities.map((city) => [city.id, city]));
    const milestones = compact.milestoneRows.map((row, ordinal) => {
      const definition = CAPABILITY_BY_ID[row.capabilityId];
      const sourceCity = cityById.get(row.sourceCityId);
      return {
        id: `capability-milestone:${String(ordinal + 1).padStart(2, "0")}`,
        kind: "capabilityMilestone",
        capability: { id: definition.id, label: definition.label },
        eraId: definition.eraId,
        discoveryYear: row.discoveryYear,
        prototypeYear: row.prototypeYear,
        standardizationYear: row.standardizationYear,
        sourceCity: { id: sourceCity.id, name: sourceCity.name, cellId: sourceCity.cellId },
        prerequisites: clone(definition.prerequisiteIds),
        resourceRequirements: definition.resourceFamilyIds.map((familyId) => clone(StrategicResourcePotential.RESOURCE_BY_ID[familyId])),
        energyRequirement: definition.energyRequirement,
        institution: clone(row.institution),
        infrastructureSites: row.infrastructureRows.map(([cityId, siteFunction, commissionedYear]) => {
          const city = cityById.get(cityId);
          return { id: `capability-site:${definition.id}:${cityId}`, cityId, cityName: city.name, cellId: city.cellId, function: siteFunction, commissionedYear, operationalAtPlayableYear: true, maintenanceRequirements: [definition.energyRequirement, ...definition.institutionRoles.slice(0, 2)] };
        }),
        adoption: clone(row.adoption),
        publicAccount: row.publicAccount
      };
    });
    const cityProfiles = compact.cityProfileRows.map(([cityId, supportComponentId, deployedCapabilityIds]) => {
      const city = cityById.get(cityId);
      return { city: { id: city.id, name: city.name, cellId: city.cellId }, supportComponentId, allStandardizedCapabilitiesKnown: true, deployedCapabilityIds: clone(deployedCapabilityIds) };
    });
    return {
      historicalHorizonYear: compact.historicalHorizonYear,
      eras: clone(compact.eras),
      milestones,
      chronology: [...milestones.map((milestone) => ({ id: milestone.id, kind: milestone.kind, year: milestone.discoveryYear, capability: clone(milestone.capability), sourceCity: clone(milestone.sourceCity), publicExplanation: milestone.publicAccount })), ...clone(compact.failureRows)].sort((left, right) => left.year - right.year || left.id.localeCompare(right.id)),
      cityProfiles,
      currentBaseline: clone(compact.currentBaseline),
      digest: compact.digest
    };
  }

  function cityCapabilityProfile(map, cityId) {
    return clone(publicCapabilityHistory(map)?.cityProfiles.find((profile) => profile.city.id === cityId) || null);
  }

  function cityHasCapability(map, cityId, capabilityId) {
    return Boolean(map?.publicCapabilityHistory?.cityProfileRows.find((row) => row[0] === cityId)?.[2].includes(capabilityId));
  }

  function validateStrategicCapabilityHistory(map, record = map?.strategicCapabilityHistory, directory = map?.publicCapabilityHistory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicCityExpansion.validateCityExpansionHistory(strategicMap);
    if (!record || !directory || record.sourceCityExpansionDigest !== strategicMap.cityExpansionHistory.digest || record.sourceResourcePotentialDigest !== strategicMap.resourcePotential.digest || record.publicDirectoryDigest !== directory.digest) throw new Error("Strategic capability history is incomplete or source-inconsistent.");
    const cities = cityRows(strategicMap);
    const cityIds = new Set(cities.map((city) => city.id));
    const componentIds = new Set(strategicMap.cityExpansionHistory.currentSupportComponents.map((component) => component.id));
    if (record.historicalHorizonYear !== strategicMap.cityExpansionHistory.historicalHorizonYear || record.milestoneRows.length !== CAPABILITY_DEFINITIONS.length || new Set(record.milestoneRows.map((row) => row.capabilityId)).size !== CAPABILITY_DEFINITIONS.length) throw new Error("Capability history does not cover the complete authored capability catalog and historical horizon.");
    for (const definition of CAPABILITY_DEFINITIONS) {
      const milestone = record.milestoneRows.find((row) => row.capabilityId === definition.id);
      if (!milestone || milestone.eraId !== definition.eraId || milestone.discoveryYear > milestone.prototypeYear || milestone.prototypeYear > milestone.standardizationYear || milestone.standardizationYear > record.historicalHorizonYear || !cityIds.has(milestone.sourceCityId) || JSON.stringify(milestone.prerequisiteIds) !== JSON.stringify(definition.prerequisiteIds) || milestone.prerequisiteIds.some((id) => record.milestoneRows.find((row) => row.capabilityId === id).standardizationYear > milestone.discoveryYear)) throw new Error(`${definition.id} has invalid chronology, provenance, or prerequisites.`);
      if (JSON.stringify(milestone.resourceRequirementRows.map((row) => row[0])) !== JSON.stringify(definition.resourceFamilyIds) || milestone.resourceRequirementRows.some((row) => !Number.isInteger(row[1]) || row[1] < 0 || row[1] > 1000) || milestone.energyRequirement !== definition.energyRequirement) throw new Error(`${definition.id} lacks causal resource or energy requirements.`);
      if (!milestone.institution?.id || milestone.institution.sourceCityId !== milestone.sourceCityId || milestone.institution.sovereignAuthority || JSON.stringify(milestone.institution.roles) !== JSON.stringify(definition.institutionRoles)) throw new Error(`${definition.id} lacks a valid non-sovereign enabling institution.`);
      if (milestone.infrastructureRows.some((site) => !cityIds.has(site.cityId) || site.capabilityId !== definition.id || site.commissionedYear < milestone.standardizationYear || site.commissionedYear > record.historicalHorizonYear || !definition.siteFunctions.includes(site.function) || !site.operationalAtPlayableYear || !site.maintenanceRequirements.includes(definition.energyRequirement))) throw new Error(`${definition.id} has invalid physical infrastructure or maintenance state.`);
      if (milestone.componentAdoptionRows.length !== componentIds.size || new Set(milestone.componentAdoptionRows.map((row) => row.supportComponentId)).size !== componentIds.size || milestone.componentAdoptionRows.some((row) => !componentIds.has(row.supportComponentId) || !row.knowsCapabilityAtPlayableYear || row.knowledgeYear > record.historicalHorizonYear)) throw new Error(`${definition.id} has incomplete component knowledge and adoption records.`);
      if (["componentHub", "componentGateway"].includes(definition.deploymentScope) && milestone.componentAdoptionRows.some((row) => !row.locallyDeploysAtPlayableYear)) throw new Error(`${definition.id} must have causal infrastructure in every support component.`);
      if (definition.deploymentScope === "universalCity" && new Set(milestone.infrastructureRows.map((site) => site.cityId)).size !== cities.length) throw new Error(`${definition.id} must be deployed in every playable-year city.`);
    }
    if (record.failedProgramRows.some((failure) => !CAPABILITY_BY_ID[failure.capabilityId] || !cityIds.has(failure.cityId) || !FAILURE_CAUSES.includes(failure.actualCause) || !FAILURE_CONSEQUENCES.includes(failure.retainedConsequence?.kind) || !failure.retainedConsequence.discoverable)) throw new Error("Retained capability failures require a physical, discoverable consequence.");
    const expandedDirectory = publicCapabilityHistory(strategicMap);
    if (directory.eras.length !== ERA_DEFINITIONS.length || directory.milestoneRows.length !== CAPABILITY_DEFINITIONS.length || directory.cityProfileRows.length !== cities.length || directory.failureRows.length !== record.failedProgramRows.length || expandedDirectory.chronology.length !== CAPABILITY_DEFINITIONS.length + record.failedProgramRows.length) throw new Error("Public capability history is incomplete.");
    if (!directory.currentBaseline.aircraftAndFlyingMountsExist || !directory.currentBaseline.mechsExist || !directory.currentBaseline.holographicSystemsExist || JSON.stringify(directory.currentBaseline.internet) !== JSON.stringify(INTERNET_BASELINE) || JSON.stringify(directory.currentBaseline.spaceflight) !== JSON.stringify(SPACEFLIGHT_BASELINE) || !directory.currentBaseline.everySupportComponentHasOrbitalGateway || !directory.currentBaseline.knowledgeDoesNotCreateMaterialSupport) throw new Error("The playable-year magitech and orbital baseline is incomplete or implies physical support.");
    const publicJson = JSON.stringify(expandedDirectory);
    if (/actualCause|hiddenConditionBand|hiddenSinglePointOfFailure|resourceRequirementRows/.test(publicJson)) throw new Error("Public capability history leaks canonical causes, conditions, or exact source scores.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.eraCount !== ERA_DEFINITIONS.length || diagnostics.capabilityCount !== CAPABILITY_DEFINITIONS.length || diagnostics.infrastructureSiteCount !== record.milestoneRows.reduce((total, row) => total + row.infrastructureRows.length, 0) || diagnostics.retainedFailureCount !== record.failedProgramRows.length || diagnostics.supportComponentCount !== componentIds.size || diagnostics.orbitalGatewayComponentCount !== componentIds.size || diagnostics.rocketLaunchSiteCount < 1) throw new Error("Capability-history diagnostics do not match saved history.");
    if (directory.digest !== `public-capability-history-${StrategicWorld.stableHash(publicCore(directory))}` || record.digest !== `capability-history-${StrategicWorld.stableHash(historyCore(record))}`) throw new Error("Capability history does not match its digest.");
    return { strategicCapabilityHistory: clone(record), publicDirectory: clone(directory) };
  }

  function attachStrategicCapabilityHistory(worldSeed, map, options = {}) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createStrategicCapabilityHistory(worldSeed, next, options);
    next.strategicCapabilityHistory = generated.strategicCapabilityHistory;
    next.publicCapabilityHistory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function auditStrategicCapabilityHistory(map) {
    const { strategicCapabilityHistory } = validateStrategicCapabilityHistory(map);
    const publicDirectory = publicCapabilityHistory(map);
    return {
      valid: true,
      capabilitiesAreCausalSystems: strategicCapabilityHistory.milestoneRows.every((row) => row.resourceRequirementRows.length && row.energyRequirement && row.institution && row.infrastructureRows.length),
      prerequisitesAreChronological: strategicCapabilityHistory.milestoneRows.every((row) => row.prerequisiteIds.every((id) => strategicCapabilityHistory.milestoneRows.find((dependency) => dependency.capabilityId === id).standardizationYear <= row.discoveryYear)),
      knowledgeAndDeploymentSeparated: strategicCapabilityHistory.milestoneRows.some((row) => row.componentAdoptionRows.some((adoption) => adoption.knowsCapabilityAtPlayableYear && !adoption.locallyDeploysAtPlayableYear)),
      everyComponentHasOrbitalGateway: publicDirectory.currentBaseline.everySupportComponentHasOrbitalGateway,
      orbitalInternetCreatesNoAuthority: !publicDirectory.currentBaseline.internet.createsPhysicalAuthority && publicDirectory.currentBaseline.knowledgeDoesNotCreateMaterialSupport,
      failuresRetainedOnlyWithConsequences: strategicCapabilityHistory.failedProgramRows.every((failure) => failure.retainedConsequence?.discoverable),
      publicHistoryHidesCanonicalWeaknesses: !JSON.stringify(publicDirectory).match(/actualCause|hiddenConditionBand|hiddenSinglePointOfFailure|resourceRequirementRows/),
      diagnostics: clone(strategicCapabilityHistory.diagnostics)
    };
  }

  return Object.freeze({
    ERA_DEFINITIONS, CAPABILITY_DEFINITIONS, CAPABILITY_BY_ID, FAILURE_CONSEQUENCES, FAILURE_CAUSES,
    INTERNET_BASELINE, SPACEFLIGHT_BASELINE, createStrategicCapabilityHistory, validateStrategicCapabilityHistory,
    attachStrategicCapabilityHistory, publicCapabilityHistory, cityCapabilityProfile, cityHasCapability,
    auditStrategicCapabilityHistory
  });
});
