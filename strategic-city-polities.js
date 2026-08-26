(function initStrategicCityPolities(root, factory) {
  const themeContent = typeof module === "object" && module.exports
    ? require("./theme-content")
    : root?.HelixThemeContent;
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const humanGeography = typeof module === "object" && module.exports
    ? require("./strategic-human-geography")
    : root?.HelixStrategicHumanGeography;
  const api = factory(themeContent, strategicWorld, humanGeography);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicCityPolities = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicCityPolitiesApi(ThemeContent, StrategicWorld, StrategicHumanGeography) {
  "use strict";

  if (!ThemeContent) throw new Error("HelixThemeContent must load before strategic-city-polities.js");
  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-city-polities.js");
  if (!StrategicHumanGeography) throw new Error("HelixStrategicHumanGeography must load before strategic-city-polities.js");

  const CITY_POLITIES_VERSION = 1;
  const POLITY_SOVEREIGNTY = "independentCityPolity";
  const INTERNET_STATUS = "globalNetworkConnected";
  const AUTHORITY_KINDS = Object.freeze(["individual", "collective"]);
  const CONTROL_CLASS_LEGEND = Object.freeze({
    ".": "wilderness",
    c: "fortifiedCore",
    a: "controlledApproach",
    i: "intermittentCorridor"
  });
  const RELATION_BASES = Object.freeze(["corridorNeighbors", "notableInternetTie"]);
  const RELATION_POSTURES = Object.freeze(["cordial", "pragmatic", "wary", "rival", "hostile"]);
  const COOPERATION_READINESS = Object.freeze(["low", "moderate", "high"]);
  const COMMUNICATION_COMPATIBILITY = Object.freeze(["clear", "frictional", "adversarial"]);
  const LOGISTICAL_DEPENDENCIES = Object.freeze([
    "aerialCourierAccess",
    "corridorIntelligence",
    "internetRelayInfrastructure",
    "localEnergyStorage",
    "materialRecovery",
    "perimeterEarlyWarning",
    "protectedAgriculture",
    "waterInfrastructure"
  ]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function seededNumber(seed, channel) {
    return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff;
  }

  function pick(values, seed, channel) {
    if (!Array.isArray(values) || !values.length) throw new Error(`City-polity content is missing ${channel}.`);
    return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length];
  }

  function pickDistinct(values, count, seed, channel) {
    return [...values]
      .map((value) => ({ value, score: seededNumber(seed, `${channel}:${value}`) }))
      .sort((left, right) => left.score - right.score || String(left.value).localeCompare(String(right.value)))
      .slice(0, Math.min(count, values.length))
      .map((entry) => entry.value);
  }

  function readableBandScore(code) {
    return ({ "0": 0, "1": 1, "2": 2, "3": 3 })[code] ?? 0;
  }

  function cityDependencies(map, city) {
    const index = StrategicWorld.cellIndex(city.cellId);
    const bands = map.publicResourceProspects.prospectBands;
    const routeCount = map.routeGraph.routes.filter((route) => route.endpointIds.includes(city.id)).length;
    const candidates = [
      ["waterInfrastructure", 4 - readableBandScore(bands.freshWater[index])],
      ["protectedAgriculture", 4 - readableBandScore(bands.biologicalProductivity[index])],
      ["materialRecovery", 4 - Math.max(readableBandScore(bands.constructionStone[index]), readableBandScore(bands.ferrousOre[index]))],
      ["localEnergyStorage", 4 - Math.max(readableBandScore(bands.geothermalEnergy[index]), readableBandScore(bands.manaCrystals[index]))],
      ["aerialCourierAccess", city.isolationBand === "extreme" ? 5 : (city.isolationBand === "remote" ? 3 : 1)],
      ["corridorIntelligence", Math.min(5, routeCount + 1)],
      ["perimeterEarlyWarning", city.wildernessExposureBand === "extreme" ? 5 : (city.wildernessExposureBand === "high" ? 4 : 2)],
      ["internetRelayInfrastructure", 3]
    ];
    return candidates
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([id]) => id);
  }

  function uniqueAuthorityName(definition, city, worldSeed, usedNames) {
    let name;
    if (definition.authorityKind === "individual") {
      const opening = pick(definition.authorityNameOpenings, `${worldSeed}:${city.id}`, "authority-name-opening");
      const ending = pick(definition.authorityNameEndings, `${worldSeed}:${city.id}`, "authority-name-ending");
      name = `${opening} ${ending}`;
    } else {
      name = ThemeContent.renderTemplate(
        pick(definition.authorityGroupTemplates, `${worldSeed}:${city.id}`, "authority-group"),
        { cityName: city.name }
      );
    }
    if (usedNames.has(name)) name = `${name} of ${city.name}`;
    let suffix = 2;
    const base = name;
    while (usedNames.has(name)) {
      name = `${base} ${suffix}`;
      suffix += 1;
    }
    usedNames.add(name);
    return name;
  }

  function createPolity(worldSeed, worldTheme, city, usedAuthorityNames) {
    const selection = ThemeContent.selectContent(ThemeContent.DEFAULT_REGISTRY, {
      kind: "cityPolityIdentity",
      worldTheme,
      seed: `${worldSeed}:${city.id}:city-polity-identity`
    });
    if (!selection.ok) throw new Error(`City-polity identity generation failed: ${selection.code}.`);
    const definition = selection.definition;
    const authorityName = uniqueAuthorityName(definition, city, worldSeed, usedAuthorityNames);
    const authorityTitle = pick(definition.authorityTitles, `${worldSeed}:${city.id}`, "authority-title");
    const polityName = ThemeContent.renderTemplate(
      pick(definition.polityNameTemplates, `${worldSeed}:${city.id}`, "polity-name"),
      { cityName: city.name }
    );
    const governingForm = pick(definition.governingForms, `${worldSeed}:${city.id}`, "governing-form");
    const successionPrinciple = pick(definition.successionPrinciples, `${worldSeed}:${city.id}`, "succession-principle");
    const publicMotto = pick(definition.mottos, `${worldSeed}:${city.id}`, "motto");
    const civicPriorities = pickDistinct(definition.civicPriorities, 3, `${worldSeed}:${city.id}`, "civic-priority");
    const publicSummary = ThemeContent.renderTemplate(definition.template, {
      cityName: city.name,
      polityName,
      authorityName,
      authorityTitle,
      governingForm
    });
    const ordinal = city.id.slice(5);
    return {
      id: `polity:${ordinal}`,
      kind: "sovereignCityPolity",
      cityId: city.id,
      cellId: city.cellId,
      name: polityName,
      sovereignty: POLITY_SOVEREIGNTY,
      internetStatus: INTERNET_STATUS,
      authority: {
        id: `authority:${ordinal}`,
        kind: definition.authorityKind,
        name: authorityName,
        title: authorityTitle
      },
      governingForm,
      successionPrinciple,
      civicPriorities,
      logisticalDependencies: [],
      publicMotto,
      publicSummary,
      themeContent: {
        definitionId: selection.definitionId,
        sourceTheme: selection.sourceTheme,
        contentTags: [...selection.contentTags]
      }
    };
  }

  function routePairKeys(map) {
    return new Set(map.routeGraph.routes.map((route) => [...route.endpointIds].sort().join("|")));
  }

  function relevantPairs(map, polityByCityId) {
    const pairs = new Map();
    for (const route of map.routeGraph.routes) {
      const cityIds = [...route.endpointIds].sort();
      const polities = cityIds.map((cityId) => polityByCityId.get(cityId));
      const key = polities.map((polity) => polity.id).sort().join("|");
      pairs.set(key, { left: polities[0], right: polities[1], basis: "corridorNeighbors" });
    }
    const polities = [...polityByCityId.values()];
    const existingCityPairs = routePairKeys(map);
    const internetCandidates = [];
    for (let left = 0; left < polities.length; left += 1) {
      for (let right = left + 1; right < polities.length; right += 1) {
        const cityKey = [polities[left].cityId, polities[right].cityId].sort().join("|");
        if (existingCityPairs.has(cityKey)) continue;
        const leftCity = map.humanGeography.cities.find((city) => city.id === polities[left].cityId);
        const rightCity = map.humanGeography.cities.find((city) => city.id === polities[right].cityId);
        const crossRegion = leftCity.topologyRegionId !== rightCity.topologyRegionId;
        internetCandidates.push({
          left: polities[left],
          right: polities[right],
          score: seededNumber(map.humanGeography.digest, `internet-tie:${polities[left].id}:${polities[right].id}`) - (crossRegion ? 0.35 : 0)
        });
      }
    }
    const internetTarget = Math.max(2, Math.floor(polities.length / 6));
    for (const candidate of internetCandidates.sort((left, right) => left.score - right.score || left.left.id.localeCompare(right.left.id)).slice(0, internetTarget)) {
      const key = [candidate.left.id, candidate.right.id].sort().join("|");
      pairs.set(key, { left: candidate.left, right: candidate.right, basis: "notableInternetTie" });
    }
    const represented = new Set([...pairs.values()].flatMap((pair) => [pair.left.id, pair.right.id]));
    for (const polity of polities.filter((entry) => !represented.has(entry.id))) {
      const other = polities
        .filter((entry) => entry.id !== polity.id)
        .map((entry) => ({ entry, score: seededNumber(map.humanGeography.digest, `fallback-internet:${polity.id}:${entry.id}`) }))
        .sort((left, right) => left.score - right.score || left.entry.id.localeCompare(right.entry.id))[0]?.entry;
      if (!other) continue;
      const key = [polity.id, other.id].sort().join("|");
      pairs.set(key, { left: polity, right: other, basis: "notableInternetTie" });
      represented.add(polity.id);
      represented.add(other.id);
    }
    return [...pairs.values()].sort((left, right) => `${left.left.id}:${left.right.id}`.localeCompare(`${right.left.id}:${right.right.id}`));
  }

  function relationFor(worldSeed, map, pair) {
    const polities = [pair.left, pair.right].sort((left, right) => left.id.localeCompare(right.id));
    const sharedPriorities = polities[0].civicPriorities.filter((priority) => polities[1].civicPriorities.includes(priority));
    const sharedDependencies = polities[0].logisticalDependencies.filter((dependency) => polities[1].logisticalDependencies.includes(dependency));
    const leftCity = map.humanGeography.cities.find((city) => city.id === polities[0].cityId);
    const rightCity = map.humanGeography.cities.find((city) => city.id === polities[1].cityId);
    const sameRegion = leftCity.topologyRegionId === rightCity.topologyRegionId;
    const noise = (seededNumber(worldSeed, `relation:${polities[0].id}:${polities[1].id}`) - 0.5) * 700;
    const score = noise
      + (pair.basis === "corridorNeighbors" ? 90 : -30)
      + (sameRegion ? 45 : 0)
      + sharedPriorities.length * 65
      - sharedDependencies.length * 35
      + (polities[0].themeContent.sourceTheme === polities[1].themeContent.sourceTheme ? 30 : -35);
    const posture = score >= 240 ? "cordial" : score >= 70 ? "pragmatic" : score >= -100 ? "wary" : score >= -260 ? "rival" : "hostile";
    const cooperationReadiness = ["cordial", "pragmatic"].includes(posture) ? "high" : (posture === "wary" ? "moderate" : "low");
    const communicationCompatibility = ["cordial", "pragmatic"].includes(posture) ? "clear" : (posture === "wary" ? "frictional" : "adversarial");
    const reasons = [pair.basis];
    if (sameRegion) reasons.push("regionalEmergencyExposure");
    if (sharedPriorities.length) reasons.push("sharedCivicPriorities");
    if (sharedDependencies.length) reasons.push("competingLogisticalNeeds");
    if (polities[0].authority.kind !== polities[1].authority.kind) reasons.push("authorityStructureDifference");
    const obligations = pair.basis === "corridorNeighbors"
      ? ["sharedMonsterWaveWarningProtocol", "corridorStatusExchange"]
      : ["openDiplomaticChannel"];
    const grievances = [];
    if (["rival", "hostile"].includes(posture)) grievances.push(pair.basis === "corridorNeighbors" ? "corridorResponsibilityDispute" : "signalAndPropagandaConflict");
    if (sharedDependencies.length && posture !== "cordial") grievances.push("resourceCompetition");
    return {
      id: `city-relation:${polities.map((polity) => polity.id.slice(7)).join("-")}`,
      cityPolityIds: polities.map((polity) => polity.id),
      basis: pair.basis,
      posture,
      cooperationReadiness,
      communicationCompatibility,
      reasons,
      standingObligations: obligations,
      grievances,
      permanentAlliance: false
    };
  }

  function controlRecord(map, polities) {
    const cellCount = map.topology.cellCount;
    const classes = new Array(cellCount).fill(".");
    const controllerByCell = new Array(cellCount).fill(-1);
    for (const route of map.routeGraph.routes) {
      for (const cellId of route.cellPath) classes[StrategicWorld.cellIndex(cellId)] = "i";
    }
    const topology = StrategicWorld.topologyForMap(map);
    polities.forEach((polity, polityIndex) => {
      const cityIndex = StrategicWorld.cellIndex(polity.cellId);
      for (const neighbor of topology.neighbors[cityIndex]) {
        if (map.surface.classes[neighbor] !== "L" || classes[neighbor] === "c") continue;
        if (controllerByCell[neighbor] < 0) {
          classes[neighbor] = "a";
          controllerByCell[neighbor] = polityIndex;
        }
      }
      classes[cityIndex] = "c";
      controllerByCell[cityIndex] = polityIndex;
    });
    return {
      encoding: "polity-control-class-by-cell-index",
      classes: classes.join(""),
      controllerByCell
    };
  }

  function cityPolitiesCore(record) {
    return {
      version: record.version,
      themeContentVersion: record.themeContentVersion,
      worldTheme: record.worldTheme,
      sourceHumanGeographyDigest: record.sourceHumanGeographyDigest,
      sourceRouteGraphDigest: record.sourceRouteGraphDigest,
      polities: record.polities,
      relations: record.relations,
      control: record.control,
      diagnostics: record.diagnostics
    };
  }

  function createCityPolities(worldSeed, worldTheme, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for sovereign city-polity generation.");
    if (!ThemeContent.WORLD_THEMES[worldTheme]) throw new Error("A valid World Theme is required for sovereign city-polity generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicHumanGeography.validateHumanGeography(strategicMap);
    const usedAuthorityNames = new Set();
    const polities = strategicMap.humanGeography.cities.map((city) => {
      const polity = createPolity(seed, worldTheme, city, usedAuthorityNames);
      polity.logisticalDependencies = cityDependencies(strategicMap, city);
      return polity;
    });
    const polityByCityId = new Map(polities.map((polity) => [polity.cityId, polity]));
    const relations = relevantPairs(strategicMap, polityByCityId).map((pair) => relationFor(seed, strategicMap, pair));
    const control = controlRecord(strategicMap, polities);
    const record = {
      version: CITY_POLITIES_VERSION,
      themeContentVersion: ThemeContent.VERSION,
      worldTheme,
      sourceHumanGeographyDigest: strategicMap.humanGeography.digest,
      sourceRouteGraphDigest: StrategicWorld.stableHash(strategicMap.routeGraph),
      polities,
      relations,
      control,
      diagnostics: {
        polityCount: polities.length,
        independentPolityCount: polities.filter((polity) => polity.sovereignty === POLITY_SOVEREIGNTY).length,
        individualAuthorityCount: polities.filter((polity) => polity.authority.kind === "individual").length,
        collectiveAuthorityCount: polities.filter((polity) => polity.authority.kind === "collective").length,
        corridorRelationCount: relations.filter((relation) => relation.basis === "corridorNeighbors").length,
        notableInternetRelationCount: relations.filter((relation) => relation.basis === "notableInternetTie").length,
        controlledCellCount: [...control.classes].filter((code) => code === "c" || code === "a").length,
        intermittentCorridorCellCount: [...control.classes].filter((code) => code === "i").length,
        postureCounts: Object.fromEntries(RELATION_POSTURES.map((posture) => [posture, relations.filter((relation) => relation.posture === posture).length])),
        themeSourceCounts: Object.fromEntries(["shared", "madcap", "grim"].map((sourceTheme) => [sourceTheme, polities.filter((polity) => polity.themeContent.sourceTheme === sourceTheme).length]))
      }
    };
    record.digest = `city-polities-${StrategicWorld.stableHash(cityPolitiesCore(record))}`;
    return record;
  }

  function validateCityPolities(map, candidate = map?.cityPolities) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicHumanGeography.validateHumanGeography(strategicMap);
    if (!candidate || typeof candidate !== "object" || Number(candidate.version) !== CITY_POLITIES_VERSION) throw new Error("Sovereign city-polity record is invalid.");
    if (!ThemeContent.WORLD_THEMES[candidate.worldTheme] || Number(candidate.themeContentVersion) !== ThemeContent.VERSION) throw new Error("Sovereign city-polity theme metadata is invalid.");
    if (candidate.sourceHumanGeographyDigest !== strategicMap.humanGeography.digest || candidate.sourceRouteGraphDigest !== StrategicWorld.stableHash(strategicMap.routeGraph)) throw new Error("Sovereign city polities do not match their source human geography.");
    if (!Array.isArray(candidate.polities) || candidate.polities.length !== strategicMap.humanGeography.cities.length || !Array.isArray(candidate.relations)) throw new Error("Sovereign city-polity records are incomplete.");
    const allowedThemes = ThemeContent.allowedCompatibilities(candidate.worldTheme);
    const cityById = new Map(strategicMap.humanGeography.cities.map((city) => [city.id, city]));
    const polityIds = new Set();
    const cityIds = new Set();
    const authorityIds = new Set();
    const authorityNames = new Set();
    const polityById = new Map();
    for (const polity of candidate.polities) {
      const city = cityById.get(polity.cityId);
      const ordinal = String(polity.cityId || "").slice(5);
      if (!city || polity.id !== `polity:${ordinal}` || polityIds.has(polity.id) || cityIds.has(polity.cityId)) throw new Error("Every fortified city requires exactly one stable sovereign polity.");
      if (polity.kind !== "sovereignCityPolity" || polity.sovereignty !== POLITY_SOVEREIGNTY || polity.internetStatus !== INTERNET_STATUS || polity.cellId !== city.cellId) throw new Error(`${polity.id} is not an independent, globally connected city polity.`);
      if (!String(polity.name || "").trim() || !AUTHORITY_KINDS.includes(polity.authority?.kind) || polity.authority?.id !== `authority:${ordinal}` || authorityIds.has(polity.authority.id) || authorityNames.has(polity.authority.name)) throw new Error(`${polity.id} has invalid sovereign authority data.`);
      if (!String(polity.authority.title || "").trim() || !String(polity.governingForm || "").trim() || !String(polity.successionPrinciple || "").trim() || !String(polity.publicMotto || "").trim() || !String(polity.publicSummary || "").trim() || /\{[a-z]/i.test(polity.publicSummary)) throw new Error(`${polity.id} has incomplete public civic identity.`);
      if (!Array.isArray(polity.civicPriorities) || polity.civicPriorities.length !== 3 || new Set(polity.civicPriorities).size !== 3) throw new Error(`${polity.id} requires three distinct civic priorities.`);
      if (!Array.isArray(polity.logisticalDependencies) || polity.logisticalDependencies.length !== 3 || new Set(polity.logisticalDependencies).size !== 3 || polity.logisticalDependencies.some((id) => !LOGISTICAL_DEPENDENCIES.includes(id))) throw new Error(`${polity.id} has invalid logistical dependencies.`);
      const definition = ThemeContent.DEFAULT_REGISTRY.find((entry) => entry.id === polity.themeContent?.definitionId);
      if (!definition || definition.kind !== "cityPolityIdentity" || definition.compatibility !== polity.themeContent.sourceTheme || !allowedThemes.includes(polity.themeContent.sourceTheme)) throw new Error(`${polity.id} contains incompatible themed political content.`);
      polityIds.add(polity.id);
      cityIds.add(polity.cityId);
      authorityIds.add(polity.authority.id);
      authorityNames.add(polity.authority.name);
      polityById.set(polity.id, polity);
    }
    const classes = String(candidate.control?.classes || "");
    if (classes.length !== strategicMap.topology.cellCount || [...classes].some((code) => !CONTROL_CLASS_LEGEND[code]) || !Array.isArray(candidate.control?.controllerByCell) || candidate.control.controllerByCell.length !== strategicMap.topology.cellCount) throw new Error("City-polity local-control encoding is invalid.");
    for (let index = 0; index < classes.length; index += 1) {
      const controllerIndex = Number(candidate.control.controllerByCell[index]);
      if (["c", "a"].includes(classes[index])) {
        if (!candidate.polities[controllerIndex] || strategicMap.surface.classes[index] !== "L") throw new Error("Effective city control references an invalid polity or ocean cell.");
      } else if (controllerIndex !== -1) throw new Error("Wilderness and intermittent corridors cannot have a continuous city controller.");
    }
    for (let polityIndex = 0; polityIndex < candidate.polities.length; polityIndex += 1) {
      const cellIndex = StrategicWorld.cellIndex(candidate.polities[polityIndex].cellId);
      if (classes[cellIndex] !== "c" || candidate.control.controllerByCell[cellIndex] !== polityIndex) throw new Error(`${candidate.polities[polityIndex].id} does not control its own fortified core.`);
    }
    const relationIds = new Set();
    const relationPairs = new Set();
    for (const relation of candidate.relations) {
      const ids = Array.isArray(relation.cityPolityIds) ? relation.cityPolityIds : [];
      const pairKey = [...ids].sort().join("|");
      if (!/^city-relation:\d{5}-\d{5}$/.test(String(relation.id || "")) || relationIds.has(relation.id) || relationPairs.has(pairKey) || ids.length !== 2 || ids.some((id) => !polityById.has(id)) || ids[0] >= ids[1]) throw new Error("City-polity relations require unique stable polity pairs.");
      if (!RELATION_BASES.includes(relation.basis) || !RELATION_POSTURES.includes(relation.posture) || !COOPERATION_READINESS.includes(relation.cooperationReadiness) || !COMMUNICATION_COMPATIBILITY.includes(relation.communicationCompatibility) || relation.permanentAlliance !== false) throw new Error(`${relation.id} has invalid non-state diplomatic classifications.`);
      if (!Array.isArray(relation.reasons) || !relation.reasons.includes(relation.basis) || !Array.isArray(relation.standingObligations) || !Array.isArray(relation.grievances)) throw new Error(`${relation.id} lacks causal public relationship facts.`);
      relationIds.add(relation.id);
      relationPairs.add(pairKey);
    }
    for (const route of strategicMap.routeGraph.routes) {
      const polityPair = route.endpointIds.map((cityId) => candidate.polities.find((polity) => polity.cityId === cityId)?.id).sort().join("|");
      const relation = candidate.relations.find((entry) => entry.cityPolityIds.join("|") === polityPair);
      if (!relation || relation.basis !== "corridorNeighbors" || !relation.standingObligations.includes("sharedMonsterWaveWarningProtocol")) throw new Error("Every intercity corridor requires a neighboring-polity warning relationship.");
    }
    const maximumPairs = candidate.polities.length * (candidate.polities.length - 1) / 2;
    if (candidate.relations.length >= maximumPairs) throw new Error("City-polity diplomacy must remain sparse rather than materializing every internet contact.");
    const expectedDigest = `city-polities-${StrategicWorld.stableHash(cityPolitiesCore(candidate))}`;
    if (candidate.digest !== expectedDigest) throw new Error("Sovereign city-polity data does not match its digest.");
    return clone(candidate);
  }

  function attachCityPolities(worldSeed, worldTheme, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    next.cityPolities = createCityPolities(worldSeed, worldTheme, next);
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function cellCityPolitySnapshot(map, index) {
    if (!map?.cityPolities || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const controllerIndex = map.cityPolities.control.controllerByCell[index];
    const controller = controllerIndex >= 0 ? map.cityPolities.polities[controllerIndex] : null;
    const cityPolity = map.cityPolities.polities.find((polity) => polity.cellId === StrategicWorld.cellId(index)) || null;
    const relevantPolity = cityPolity || controller;
    return {
      controlClass: CONTROL_CLASS_LEGEND[map.cityPolities.control.classes[index]],
      controller: controller ? clone(controller) : null,
      cityPolity: cityPolity ? clone(cityPolity) : null,
      relations: relevantPolity
        ? map.cityPolities.relations
          .filter((relation) => relation.cityPolityIds.includes(relevantPolity.id))
          .map((relation) => ({
            ...clone(relation),
            counterpart: clone(map.cityPolities.polities.find((polity) => relation.cityPolityIds.includes(polity.id) && polity.id !== relevantPolity.id))
          }))
        : []
    };
  }

  function auditCityPolities(map) {
    const record = validateCityPolities(map);
    const landCellCount = [...map.surface.classes].filter((code) => code === "L").length;
    const corridorRelations = record.relations.filter((relation) => relation.basis === "corridorNeighbors");
    return {
      valid: true,
      polityCount: record.polities.length,
      cityCount: map.humanGeography.cities.length,
      oneIndependentPolityPerCity: record.polities.length === map.humanGeography.cities.length && new Set(record.polities.map((polity) => polity.cityId)).size === record.polities.length,
      maximumCitiesPerPolity: 1,
      globalInternetCoverage: record.polities.every((polity) => polity.internetStatus === INTERNET_STATUS),
      individualAuthorityCount: record.diagnostics.individualAuthorityCount,
      collectiveAuthorityCount: record.diagnostics.collectiveAuthorityCount,
      relationCount: record.relations.length,
      maximumPossibleRelationCount: record.polities.length * (record.polities.length - 1) / 2,
      sparseDiplomacy: record.relations.length < record.polities.length * 4,
      corridorWarningCoverage: corridorRelations.every((relation) => relation.standingObligations.includes("sharedMonsterWaveWarningProtocol")),
      permanentAllianceCount: record.relations.filter((relation) => relation.permanentAlliance).length,
      controlledLandPercent: record.diagnostics.controlledCellCount / Math.max(1, landCellCount) * 100,
      themeSourceCounts: clone(record.diagnostics.themeSourceCounts),
      postureCounts: clone(record.diagnostics.postureCounts)
    };
  }

  return Object.freeze({
    CITY_POLITIES_VERSION,
    POLITY_SOVEREIGNTY,
    INTERNET_STATUS,
    AUTHORITY_KINDS,
    CONTROL_CLASS_LEGEND,
    RELATION_BASES,
    RELATION_POSTURES,
    COOPERATION_READINESS,
    COMMUNICATION_COMPATIBILITY,
    LOGISTICAL_DEPENDENCIES,
    createCityPolities,
    validateCityPolities,
    attachCityPolities,
    cellCityPolitySnapshot,
    auditCityPolities,
    clone
  });
});
