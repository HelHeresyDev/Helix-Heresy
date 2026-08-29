(function initStrategicNonStateNetworks(root, factory) {
  const themeContent = typeof module === "object" && module.exports ? require("./theme-content") : root?.HelixThemeContent;
  const strategicWorld = typeof module === "object" && module.exports ? require("./strategic-world") : root?.HelixStrategicWorld;
  const strategicReligions = typeof module === "object" && module.exports ? require("./strategic-religions") : root?.HelixStrategicReligions;
  const strategicCapabilityHistory = typeof module === "object" && module.exports ? require("./strategic-capability-history") : root?.HelixStrategicCapabilityHistory;
  const api = factory(themeContent, strategicWorld, strategicReligions, strategicCapabilityHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixStrategicNonStateNetworks = api;
})(typeof window !== "undefined" ? window : globalThis, function createStrategicNonStateNetworksApi(ThemeContent, StrategicWorld, StrategicReligions, StrategicCapabilityHistory) {
  "use strict";

  if (!ThemeContent) throw new Error("HelixThemeContent must load before strategic-non-state-networks.js");
  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before strategic-non-state-networks.js");
  if (!StrategicReligions) throw new Error("HelixStrategicReligions must load before strategic-non-state-networks.js");
  if (!StrategicCapabilityHistory) throw new Error("HelixStrategicCapabilityHistory must load before strategic-non-state-networks.js");

  const NETWORK_CATEGORIES = Object.freeze(["commercial", "research", "military", "transport", "media", "blackMarket", "standards"]);
  const CAPABILITY_KEYS = Object.freeze(["finance", "research", "transport", "armedForce", "mediaReach", "certification", "covertAccess"]);
  const CAPABILITY_BANDS = Object.freeze(["negligible", "limited", "established", "strong", "exceptional"]);
  const CITY_STANDINGS = Object.freeze(["chartered", "licensed", "recognized", "tolerated", "restricted", "proscribed"]);
  const STANDING_CODES = Object.freeze({ chartered: "c", licensed: "l", recognized: "r", tolerated: "t", restricted: "x", proscribed: "p" });
  const STANDING_BY_CODE = Object.freeze(Object.fromEntries(Object.entries(STANDING_CODES).map(([key, value]) => [value, key])));
  const BRANCH_FORMS = Object.freeze(["registeredOffice", "localLaboratory", "contractDepot", "escortChapter", "relayStudio", "standardsBureau", "brokerFront", "covertMarketCell", "launchOffice", "orbitalRelayGateway", "trainingHall", "memberForum"]);
  const BRANCH_CAPACITY_BANDS = Object.freeze(["nominal", "limited", "functional", "strong", "regionalHub"]);
  const SERVICE_RELIABILITY_BANDS = Object.freeze(["unreliable", "intermittent", "scheduled", "dependable"]);
  const PUBLIC_RELATIONS = Object.freeze(["partnership", "dependency", "rivalry", "boycott", "sharedStandards", "contractService"]);
  const DECLARED_ACTIVITIES = Object.freeze(["chemicalSupply", "technicalConsulting", "freightBrokerage", "dataServices", "equipmentLeasing", "riskManagement", "orbitalTelemetry"]);
  const AFFILIATE_DISCLOSURES = Object.freeze(["disclosedSubsidiary", "opaqueBeneficialOwnership"]);
  const COVERT_CELL_KINDS = Object.freeze(["brokerCell", "smugglingCoordinator", "launderingOffice", "informantExchange"]);
  const HIDDEN_PRIORITIES = Object.freeze(["expandAccess", "secureSupply", "captureStandards", "collectIntelligence", "concealOwnership", "undermineRival"]);
  const HIDDEN_INFLUENCE_KINDS = Object.freeze(["infiltration", "covertCooperation", "financialLeverage"]);
  const CAPABILITY_BIASES = Object.freeze({
    commercial: [4, 1, 2, 0, 2, 2, 2], research: [2, 4, 1, 0, 2, 3, 1], military: [2, 2, 3, 4, 1, 2, 2],
    transport: [2, 1, 4, 2, 1, 2, 3], media: [2, 2, 1, 0, 4, 2, 2], blackMarket: [3, 1, 3, 2, 1, 0, 4], standards: [2, 3, 1, 0, 2, 4, 0]
  });

  const INTERNET_BASELINE = StrategicCapabilityHistory.INTERNET_BASELINE;
  const SPACEFLIGHT_BASELINE = StrategicCapabilityHistory.SPACEFLIGHT_BASELINE;

  function networkDefinition(category, compatibility, id, properties) {
    return Object.freeze({
      id: `non-state-network.${compatibility}.${id}`,
      kind: "nonStateNetworkArchetype",
      compatibility,
      category,
      template: "{networkName}",
      ...properties,
      contentTags: Object.freeze(properties.contentTags.map((tag) => ({ commerce: "fortified-civilization", covert: "coercion" })[tag] || tag)),
      nameTemplates: Object.freeze([...properties.nameTemplates]),
      roles: Object.freeze([...properties.roles]),
      priorities: Object.freeze([...properties.priorities]),
      prohibitions: Object.freeze([...properties.prohibitions]),
      branchForms: Object.freeze([...properties.branchForms]),
      orbitalRoles: Object.freeze([...(properties.orbitalRoles || [])])
    });
  }

  const NETWORK_DEFINITIONS = Object.freeze([
    networkDefinition("commercial", "shared", "meridian-holdings", { contentTags: ["commerce", "neutral"], nameTemplates: ["{cityName} Meridian Holdings", "Meridian Mutual Exchange", "The Intercity Provision Group"], publicPurpose: "Coordinate finance, procurement, equipment leasing, and lawful commercial affiliates across independent cities.", roles: ["finance", "procurement", "equipmentLeasing", "commercialRegistryLiaison", "affiliateAdministration"], priorities: ["predictable settlement", "diverse suppliers", "recognized contracts"], prohibitions: ["claiming sovereign immunity", "uncollateralized survival-critical speculation"], branchForms: ["registeredOffice", "contractDepot"], orbitalRoles: ["launchFinance"] }),
    networkDefinition("commercial", "madcap", "improbable-ventures", { contentTags: ["absurdity", "commerce", "invention"], nameTemplates: ["{cityName} Improbable Ventures", "The Sensible Risk Carnival", "Bright Idea Holdings"], publicPurpose: "Finance unusual but presentable inventions through aggressively cheerful corporate families.", roles: ["ventureFinance", "procurement", "equipmentLeasing", "publicRelations", "affiliateAdministration"], priorities: ["novel products", "recoverable mistakes", "memorable branding"], prohibitions: ["boring fraud", "abandoning hazardous prototypes without labels"], branchForms: ["registeredOffice", "memberForum"], orbitalRoles: ["experimentalLaunchSponsorship"] }),
    networkDefinition("commercial", "grim", "continuity-combine", { contentTags: ["commerce", "scarcity", "survival"], nameTemplates: ["{cityName} Continuity Combine", "Last-Mile Asset Union", "The Bastion Provision Trust"], publicPurpose: "Preserve supply ownership and industrial continuity through siege, isolation, and institutional collapse.", roles: ["assetCustody", "procurement", "equipmentLeasing", "debtAdministration", "affiliateAdministration"], priorities: ["secured inventory", "enforceable collateral", "continuity reserves"], prohibitions: ["unrecorded losses", "surrendering strategic stock"], branchForms: ["registeredOffice", "contractDepot"], orbitalRoles: ["orbitalAssetCustody"] }),

    networkDefinition("research", "shared", "open-lattice", { contentTags: ["science", "magic", "neutral"], nameTemplates: ["{cityName} Open Lattice", "The Intercity Research Exchange", "Lattice Collegium"], publicPurpose: "Exchange reproducible scientific and magical findings while preserving city-specific licensing and controlled-field restrictions.", roles: ["peerReview", "dataExchange", "accreditation", "specimenProtocol", "controlledFieldReview"], priorities: ["reproducible findings", "traceable samples", "interoperable methods"], prohibitions: ["fabricated results", "unconsented experimentation"], branchForms: ["localLaboratory", "standardsBureau"], orbitalRoles: ["orbitalResearchCoordination"] }),
    networkDefinition("research", "madcap", "eureka-cooperative", { contentTags: ["absurdity", "hope", "science"], nameTemplates: ["The {cityName} Eureka Cooperative", "Unexpected Results Society", "The Third Attempt Exchange"], publicPurpose: "Connect researchers who believe that failed experiments become useful once properly documented.", roles: ["peerReview", "prototypeExchange", "failureArchive", "accreditation", "publicDemonstration"], priorities: ["documented surprises", "shared apparatus", "consensual experimentation"], prohibitions: ["discarding negative results", "pretending explosions were planned"], branchForms: ["localLaboratory", "memberForum"], orbitalRoles: ["microgravityExperimentExchange"] }),
    networkDefinition("research", "grim", "sealed-archive", { contentTags: ["science", "survival", "institutional-cruelty"], nameTemplates: ["The {cityName} Sealed Archive", "Black Vault Research Compact", "The Continuity Method Directorate"], publicPurpose: "Preserve dangerous knowledge under compartmented access, strict custody, and survival-driven review.", roles: ["restrictedArchive", "peerReview", "clearanceAccreditation", "specimenCustody", "hazardReview"], priorities: ["knowledge continuity", "controlled access", "defensible methods"], prohibitions: ["unlogged copying", "unauthorized soul research"], branchForms: ["localLaboratory", "standardsBureau"], orbitalRoles: ["sealedOrbitalArchive"] }),

    networkDefinition("military", "shared", "bastion-contract", { contentTags: ["survival", "warfare", "neutral"], nameTemplates: ["{cityName} Bastion Contract", "The Independent Escort Compact", "Bastion Response Exchange"], publicPurpose: "Coordinate contracted escorts, monster-response specialists, training, and compatible equipment without creating a standing alliance.", roles: ["escortContracting", "monsterResponse", "training", "equipmentCompatibility", "threatIntelligence"], priorities: ["bounded contracts", "civilian evacuation", "interoperable response"], prohibitions: ["uncontracted occupation", "claiming police authority"], branchForms: ["escortChapter", "trainingHall"], orbitalRoles: [] }),
    networkDefinition("military", "madcap", "heroic-temporary", { contentTags: ["absurdity", "hope", "warfare"], nameTemplates: ["The {cityName} Temporarily Heroic Company", "Dramatic Rescue Cooperative", "The Capes and Convoys Compact"], publicPurpose: "Provide theatrical but contractually bounded rescue, escort, and monster-diversion specialists.", roles: ["escortContracting", "rescue", "monsterDiversion", "training", "publicMorale"], priorities: ["visible rescues", "survivable heroics", "clear retreat clauses"], prohibitions: ["fatal last stands for branding", "unauthorized capes near turbines"], branchForms: ["escortChapter", "trainingHall"], orbitalRoles: ["individualSpacefarerRescue"] }),
    networkDefinition("military", "grim", "iron-cordon", { contentTags: ["survival", "warfare", "coercion"], nameTemplates: ["The {cityName} Iron Cordon", "Ash March Security Compact", "The Last Perimeter Company"], publicPurpose: "Sell disciplined perimeter defense, convoy force, and catastrophic monster-response capability under narrow written mandates.", roles: ["perimeterDefense", "convoyForce", "monsterResponse", "training", "threatIntelligence"], priorities: ["mission completion", "defensible withdrawal", "ammunition reserves"], prohibitions: ["unpaid occupation", "command beyond contract scope"], branchForms: ["escortChapter", "trainingHall"], orbitalRoles: ["orbitalThreatInterception"] }),

    networkDefinition("transport", "shared", "skychain-courier", { contentTags: ["commerce", "invention", "magic"], nameTemplates: ["{cityName} Skychain Courier", "The Skychain Dispatch", "Intercity Launch and Courier Cooperative"], publicPurpose: "Coordinate local couriers, defended transfers, orbital relays, and scarce rocket launches without promising continuous long-range freight.", roles: ["courierDispatch", "freightBrokerage", "routeHandoffs", "launchScheduling", "orbitalRelayOperations"], priorities: ["verified handoffs", "survivable routes", "relay uptime"], prohibitions: ["guaranteeing unsafe delivery", "launching unmanifested cargo"], branchForms: ["contractDepot", "launchOffice", "orbitalRelayGateway"], orbitalRoles: ["rocketLaunchServices", "orbitalRelayOperations"] }),
    networkDefinition("transport", "madcap", "comet-post", { contentTags: ["absurdity", "commerce", "invention"], nameTemplates: ["The {cityName} Comet Post", "Definitely Arriving Courier", "Comet-and-Catapult Dispatch"], publicPurpose: "Arrange fast messages, improbable handoffs, and carefully licensed rocket consignments.", roles: ["courierDispatch", "freightBrokerage", "routeHandoffs", "launchScheduling", "emergencyMessages"], priorities: ["fast confirmation", "creative routing", "recoverable parcels"], prohibitions: ["literal postal catapults inside city walls", "declaring loss before checking orbit"], branchForms: ["contractDepot", "launchOffice", "memberForum"], orbitalRoles: ["rocketLaunchServices", "orbitalParcelRecovery"] }),
    networkDefinition("transport", "grim", "black-sky-logistics", { contentTags: ["commerce", "scarcity", "survival"], nameTemplates: ["{cityName} Black-Sky Logistics", "The Ash Orbit Dispatch", "Last Route Carriage"], publicPurpose: "Coordinate hardened couriers, costly launches, and surface handoffs through regions where routes routinely fail.", roles: ["courierDispatch", "armoredHandoffs", "freightBrokerage", "launchScheduling", "orbitalRelayOperations"], priorities: ["cargo custody", "redundant manifests", "survival margins"], prohibitions: ["unescorted strategic cargo", "false route-clearance claims"], branchForms: ["contractDepot", "launchOffice", "orbitalRelayGateway"], orbitalRoles: ["rocketLaunchServices", "orbitalRelayOperations"] }),

    networkDefinition("media", "shared", "aethercast", { contentTags: ["invention", "magic", "neutral"], nameTemplates: ["{cityName} Aethercast", "The Aethercast Mesh", "Orbital Arcane Public Relay"], publicPurpose: "Operate newsrooms, public channels, and authenticated services across an orbital satellite constellation reinforced by magical relays.", roles: ["newsDistribution", "publicChannels", "identityAuthentication", "relayOperations", "emergencyBroadcast"], priorities: ["relay uptime", "source attribution", "emergency access"], prohibitions: ["claiming territorial authority", "silencing verified wave warnings"], branchForms: ["relayStudio", "orbitalRelayGateway"], orbitalRoles: ["orbitalRelayOperations"] }),
    networkDefinition("media", "madcap", "sparkfeed", { contentTags: ["absurdity", "hope", "invention"], nameTemplates: ["{cityName} Sparkfeed", "The Very Live Network", "Sparkfeed Orbital Variety Mesh"], publicPurpose: "Carry news, entertainment, emergency messages, and aggressively interactive public channels through magical orbital relays.", roles: ["newsDistribution", "entertainment", "publicChannels", "relayOperations", "emergencyBroadcast"], priorities: ["audience participation", "fast corrections", "memorable warnings"], prohibitions: ["jingles over evacuation orders", "unlabeled illusion filters"], branchForms: ["relayStudio", "memberForum", "orbitalRelayGateway"], orbitalRoles: ["orbitalRelayOperations"] }),
    networkDefinition("media", "grim", "watchsignal", { contentTags: ["survival", "scarcity", "institutional-cruelty"], nameTemplates: ["{cityName} Watchsignal", "The Closed-Eye Relay", "Watchsignal Continuity Mesh"], publicPurpose: "Maintain authenticated news, threat alerts, and resilient orbital relay service under siege and censorship pressure.", roles: ["threatBroadcast", "newsDistribution", "sourceVerification", "relayOperations", "archiveContinuity"], priorities: ["warning continuity", "authenticated sources", "hardened relays"], prohibitions: ["fabricated attack alerts", "unlogged signal suppression"], branchForms: ["relayStudio", "orbitalRelayGateway"], orbitalRoles: ["orbitalRelayOperations", "hardenedSatelliteService"] }),

    networkDefinition("blackMarket", "shared", "night-ledger", { contentTags: ["commerce", "covert", "neutral"], nameTemplates: ["The {cityName} Night Ledger", "Night Ledger Exchange", "The Quiet Brokerage"], publicPurpose: "A publicly designated illicit brokerage ecosystem associated with contraband, concealed ownership, and unlicensed transfers.", roles: ["contrabandBrokerage", "smugglingCoordination", "laundering", "covertMessaging", "contactReferral"], priorities: ["trusted intermediaries", "deniable custody", "repeat business"], prohibitions: ["public membership rolls", "unpaid exposure"], branchForms: ["brokerFront", "covertMarketCell"], orbitalRoles: ["illicitOrbitalHandoffs"] }),
    networkDefinition("blackMarket", "madcap", "under-table", { contentTags: ["absurdity", "commerce", "covert"], nameTemplates: ["The {cityName} Under-Table Fair", "Totally Ordinary Brokerage", "The Unadvertised Bazaar"], publicPurpose: "A notorious informal market whose alleged members deny everything except the quality of their customer service.", roles: ["contrabandBrokerage", "contactReferral", "smugglingCoordination", "laundering", "covertMessaging"], priorities: ["repeat customers", "creative packaging", "plausible invoices"], prohibitions: ["using actual tables as legal defenses", "selling cursed goods without punctuation"], branchForms: ["brokerFront", "covertMarketCell"], orbitalRoles: ["illicitOrbitalHandoffs"] }),
    networkDefinition("blackMarket", "grim", "hollow-chain", { contentTags: ["commerce", "covert", "survival"], nameTemplates: ["The {cityName} Hollow Chain", "Hollow Chain Exchange", "The Ashen Brokerage"], publicPurpose: "A proscribed chain of brokers, smugglers, and shell entities operating through scarcity, coercion, and compartmented trust.", roles: ["contrabandBrokerage", "smugglingCoordination", "laundering", "covertMessaging", "contactReferral"], priorities: ["compartmented cells", "scarce cargo", "enforceable silence"], prohibitions: ["unnecessary witnesses", "unverified intermediaries"], branchForms: ["brokerFront", "covertMarketCell"], orbitalRoles: ["illicitOrbitalHandoffs"] }),

    networkDefinition("standards", "shared", "common-measure", { contentTags: ["commerce", "science", "neutral"], nameTemplates: ["The {cityName} Common Measure", "Common Measure Consortium", "Intercity Protocol Bureau"], publicPurpose: "Publish voluntary technical, identity, laboratory, cargo, and orbital-communications standards recognized independently by each city.", roles: ["technicalStandards", "identityTrust", "laboratoryAccreditation", "cargoProtocols", "orbitalCommunicationProtocols"], priorities: ["interoperability", "auditable certification", "stable semantic identifiers"], prohibitions: ["claiming legal supremacy", "secret mandatory standards"], branchForms: ["standardsBureau", "registeredOffice"], orbitalRoles: ["orbitalCommunicationProtocols"] }),
    networkDefinition("standards", "madcap", "universal-adapter", { contentTags: ["absurdity", "invention", "science"], nameTemplates: ["The {cityName} Universal Adapter Society", "Universal Adapter Consortium", "The Surprisingly Compatible Bureau"], publicPurpose: "Convince incompatible machines, magical relays, laboratories, and cities to agree on at least one connector.", roles: ["technicalStandards", "identityTrust", "laboratoryAccreditation", "connectorProtocols", "orbitalCommunicationProtocols"], priorities: ["backward compatibility", "readable labels", "fewer proprietary screws"], prohibitions: ["seventeen mutually exclusive universal standards", "unmarked polarity"], branchForms: ["standardsBureau", "memberForum"], orbitalRoles: ["orbitalCommunicationProtocols"] }),
    networkDefinition("standards", "grim", "sealed-measure", { contentTags: ["science", "scarcity", "survival"], nameTemplates: ["The {cityName} Sealed Measure", "Continuity Standards Compact", "The Black Mark Bureau"], publicPurpose: "Maintain hardened identity, cargo, laboratory, and orbital protocols when trust and infrastructure fail.", roles: ["technicalStandards", "identityTrust", "hazardCertification", "cargoProtocols", "orbitalCommunicationProtocols"], priorities: ["failure-resistant protocols", "custody verification", "survival interoperability"], prohibitions: ["uncertified substitutions", "unlogged emergency overrides"], branchForms: ["standardsBureau", "registeredOffice"], orbitalRoles: ["orbitalCommunicationProtocols"] })
  ]);
  const NETWORK_REGISTRY = ThemeContent.createRegistry(NETWORK_DEFINITIONS);
  const DEFINITION_BY_ID = new Map(NETWORK_DEFINITIONS.map((definition) => [definition.id, definition]));

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function seededNumber(seed, channel) { return parseInt(StrategicWorld.stableHash(`${seed}:${channel}`), 16) / 0xffffffff; }
  function pick(values, seed, channel) { return values[Math.floor(seededNumber(seed, channel) * values.length) % values.length]; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function cityCode(index) { return index.toString(36).padStart(2, "0"); }

  function citySuitability(map, city, category, seed) {
    const infrastructure = ({ limited: 120, adequate: 240, strong: 360, formidable: 480 })[city.infrastructurePotentialBand] || 0;
    const isolation = ({ extreme: -120, remote: -40, connected: 120 })[city.isolationBand] || 0;
    const corridorDegree = map.humanGeography.corridors.filter((corridor) => corridor.endpointCityIds.includes(city.id)).length * (category === "transport" || category === "commercial" ? 100 : 35);
    const advantages = city.foundingAdvantages.reduce((score, advantage) => score + ({ transportPosition: 130, manaAccess: 100, constructionMaterials: 80, defensibleTerrain: category === "military" ? 120 : 20 }[advantage] || 25), 0);
    return infrastructure + isolation + corridorDegree + advantages + seededNumber(seed, `origin:${category}:${city.id}`) * 500;
  }

  function createNetworkRecords(seed, map, worldTheme) {
    const records = [];
    const usedNames = new Set();
    for (const [categoryIndex, category] of NETWORK_CATEGORIES.entries()) {
      const eligible = ThemeContent.eligibleDefinitions(NETWORK_REGISTRY, { kind: "nonStateNetworkArchetype", worldTheme }).filter((definition) => definition.category === category);
      const ordered = [...eligible].sort((left, right) => seededNumber(seed, `definition:${category}:${left.id}`) - seededNumber(seed, `definition:${category}:${right.id}`) || left.id.localeCompare(right.id));
      const rankedCities = [...map.humanGeography.cities].sort((left, right) => citySuitability(map, right, category, seed) - citySuitability(map, left, category, seed) || left.id.localeCompare(right.id));
      for (let ordinal = 0; ordinal < 3; ordinal += 1) {
        const definition = ordered[ordinal % ordered.length];
        const originCity = rankedCities[(ordinal * 3 + categoryIndex) % rankedCities.length];
        let name = ThemeContent.renderTemplate(pick(definition.nameTemplates, seed, `name:${category}:${ordinal}`), { cityName: originCity.name });
        if (usedNames.has(name)) name = `${name} ${ordinal + 1}`;
        usedNames.add(name);
        const capabilityCodes = CAPABILITY_BIASES[category].map((bias, capabilityIndex) => clamp(bias + Math.floor(seededNumber(seed, `capability:${category}:${ordinal}:${capabilityIndex}`) * 3) - 1, 0, 4).toString(36)).join("");
        records.push({
          id: `network:${category}:${String(ordinal + 1).padStart(2, "0")}`,
          definitionId: definition.id,
          name,
          originCityIndex: map.humanGeography.cities.indexOf(originCity),
          capabilityCodes,
          reputationCode: Math.floor(seededNumber(seed, `reputation:${category}:${ordinal}`) * 5).toString(36)
        });
      }
    }
    return records;
  }

  function lawAdjustment(map, cityIndex, category) {
    const entry = map.publicCityLawDirectory.entries[cityIndex];
    const indexes = category === "commercial" ? [4, 8] : category === "research" ? [9, 10, 11, 12] : category === "blackMarket" ? [7] : category === "transport" ? [5, 8] : [];
    if (!indexes.length) return 0;
    const score = indexes.reduce((sum, index) => sum + ({ p: -2, r: -1, l: 1, t: 2, u: 2 })[entry.legalStatusCodes[index]], 0) / indexes.length;
    return score * 0.055;
  }

  function createStandingRows(seed, map, records) {
    const rows = map.humanGeography.cities.map((city, cityIndex) => records.map((record, networkIndex) => {
      const definition = DEFINITION_BY_ID.get(record.definitionId);
      const roll = seededNumber(seed, `standing:${city.id}:${record.id}`) - lawAdjustment(map, cityIndex, definition.category);
      if (definition.category !== "blackMarket" && cityIndex === record.originCityIndex) return STANDING_CODES.chartered;
      if (definition.category === "blackMarket") return roll < 0.06 ? STANDING_CODES.tolerated : (roll < 0.22 ? STANDING_CODES.restricted : STANDING_CODES.proscribed);
      return roll < 0.12 ? STANDING_CODES.licensed : (roll < 0.42 ? STANDING_CODES.recognized : (roll < 0.72 ? STANDING_CODES.tolerated : (roll < 0.9 ? STANDING_CODES.restricted : STANDING_CODES.proscribed)));
    }));
    for (let networkIndex = 0; networkIndex < records.length; networkIndex += 1) {
      if (DEFINITION_BY_ID.get(records[networkIndex].definitionId).category === "blackMarket") continue;
      const physicalCount = rows.filter((row) => ["c", "l", "r"].includes(row[networkIndex])).length;
      if (physicalCount >= 2) continue;
      const candidates = map.humanGeography.cities.map((city, cityIndex) => ({ cityIndex, score: seededNumber(seed, `minimum-presence:${records[networkIndex].id}:${city.id}`) })).sort((left, right) => right.score - left.score);
      for (const candidate of candidates.slice(0, 2 - physicalCount)) rows[candidate.cityIndex][networkIndex] = STANDING_CODES.recognized;
    }
    return rows.map((row) => row.join(""));
  }

  function createPublicBranchCodes(seed, map, records, standingRows) {
    const codes = [];
    for (let cityIndex = 0; cityIndex < standingRows.length; cityIndex += 1) {
      for (let networkIndex = 0; networkIndex < records.length; networkIndex += 1) {
        const standing = STANDING_BY_CODE[standingRows[cityIndex][networkIndex]];
        const chance = ({ chartered: 1, licensed: 1, recognized: 1, tolerated: 0.35, restricted: 0.08, proscribed: 0 })[standing];
        if (seededNumber(seed, `public-branch:${cityIndex}:${networkIndex}`) >= chance) continue;
        const definition = DEFINITION_BY_ID.get(records[networkIndex].definitionId);
        const form = pick(definition.branchForms, seed, `branch-form:${cityIndex}:${networkIndex}`);
        const capacity = clamp(Math.floor(seededNumber(seed, `branch-capacity:${cityIndex}:${networkIndex}`) * 4) + (["chartered", "licensed"].includes(standing) ? 1 : 0), 0, 4);
        const reliability = clamp(Math.floor(seededNumber(seed, `branch-reliability:${cityIndex}:${networkIndex}`) * 4), 0, 3);
        codes.push(`${cityCode(cityIndex)}${networkIndex.toString(36)}${BRANCH_FORMS.indexOf(form).toString(36)}${capacity.toString(36)}${reliability.toString(36)}`);
      }
    }
    return codes;
  }

  function createPublicRelationCodes(seed, records) {
    const relations = new Map();
    for (let left = 0; left < records.length; left += 1) {
      let right = Math.floor(seededNumber(seed, `public-relation-target:${left}`) * records.length) % records.length;
      if (right === left) right = (right + 1) % records.length;
      const pair = [left, right].sort((a, b) => a - b);
      const leftCategory = DEFINITION_BY_ID.get(records[pair[0]].definitionId).category;
      const rightCategory = DEFINITION_BY_ID.get(records[pair[1]].definitionId).category;
      const relation = leftCategory === rightCategory ? "rivalry"
        : leftCategory === "standards" || rightCategory === "standards" ? "sharedStandards"
          : [leftCategory, rightCategory].includes("transport") && [leftCategory, rightCategory].includes("commercial") ? "contractService"
            : pick(PUBLIC_RELATIONS, seed, `public-relation:${pair.join(":")}`);
      relations.set(pair.join(":"), `${pair[0].toString(36)}${pair[1].toString(36)}${PUBLIC_RELATIONS.indexOf(relation).toString(36)}`);
    }
    return [...relations.values()].sort();
  }

  function createAffiliateCodes(seed, map, records) {
    const codes = [];
    records.forEach((record, networkIndex) => {
      const category = DEFINITION_BY_ID.get(record.definitionId).category;
      const count = category === "commercial" ? 3 : (category === "blackMarket" ? 2 : 0);
      for (let ordinal = 0; ordinal < count; ordinal += 1) {
        const cityIndex = Math.floor(seededNumber(seed, `affiliate-city:${networkIndex}:${ordinal}`) * map.humanGeography.cities.length) % map.humanGeography.cities.length;
        const activityIndex = Math.floor(seededNumber(seed, `affiliate-activity:${networkIndex}:${ordinal}`) * DECLARED_ACTIVITIES.length) % DECLARED_ACTIVITIES.length;
        const disclosureIndex = seededNumber(seed, `affiliate-disclosure:${networkIndex}:${ordinal}`) < (category === "commercial" ? 0.55 : 0.08) ? 0 : 1;
        codes.push(`${networkIndex.toString(36)}${ordinal.toString(36)}${cityCode(cityIndex)}${activityIndex.toString(36)}${disclosureIndex.toString(36)}`);
      }
    });
    return codes;
  }

  function createHiddenRecords(seed, map, records, affiliateCodes, standingRows) {
    const covertPresenceCodes = [];
    records.forEach((record, networkIndex) => {
      const category = DEFINITION_BY_ID.get(record.definitionId).category;
      if (category !== "blackMarket" && !(category === "commercial" && seededNumber(seed, `commercial-covert:${networkIndex}`) < 0.5)) return;
      const desired = category === "blackMarket" ? 4 : 2;
      const ranked = map.humanGeography.cities.map((city, cityIndex) => ({ cityIndex, score: seededNumber(seed, `covert-city:${networkIndex}:${city.id}`) + (["x", "p"].includes(standingRows[cityIndex][networkIndex]) ? 0.35 : 0) })).sort((left, right) => right.score - left.score);
      for (const { cityIndex } of ranked.slice(0, desired)) {
        const kindIndex = Math.floor(seededNumber(seed, `covert-kind:${networkIndex}:${cityIndex}`) * COVERT_CELL_KINDS.length) % COVERT_CELL_KINDS.length;
        covertPresenceCodes.push(`${cityCode(cityIndex)}${networkIndex.toString(36)}${kindIndex.toString(36)}`);
      }
    });
    const hiddenNetworkStateCodes = records.map((record, index) => `${Math.floor(seededNumber(seed, `actual-capacity:${index}`) * 5)}${Math.floor(seededNumber(seed, `integrity:${index}`) * 5)}${Math.floor(seededNumber(seed, `private-priority:${index}`) * HIDDEN_PRIORITIES.length).toString(36)}`).join("");
    const hiddenAffiliatePurposeCodes = affiliateCodes.map((code, index) => Math.floor(seededNumber(seed, `affiliate-purpose:${code}:${index}`) * HIDDEN_PRIORITIES.length).toString(36)).join("");
    const hiddenInfluenceCodes = [];
    const usedPairs = new Set();
    for (let index = 0; index < 10; index += 1) {
      let left = Math.floor(seededNumber(seed, `hidden-left:${index}`) * records.length) % records.length;
      let right = Math.floor(seededNumber(seed, `hidden-right:${index}`) * records.length) % records.length;
      if (left === right) right = (right + 1) % records.length;
      [left, right] = [left, right].sort((a, b) => a - b);
      if (usedPairs.has(`${left}:${right}`)) continue;
      usedPairs.add(`${left}:${right}`);
      const kind = Math.floor(seededNumber(seed, `hidden-kind:${index}`) * HIDDEN_INFLUENCE_KINDS.length) % HIDDEN_INFLUENCE_KINDS.length;
      hiddenInfluenceCodes.push(`${left.toString(36)}${right.toString(36)}${kind.toString(36)}`);
    }
    return { covertPresenceCodes, hiddenNetworkStateCodes, hiddenAffiliatePurposeCodes, hiddenInfluenceCodes };
  }

  function expandNetwork(record, directory, map) {
    const definition = DEFINITION_BY_ID.get(record.definitionId);
    const originCity = map.humanGeography.cities[record.originCityIndex];
    return {
      id: record.id, kind: "nonStateNetwork", category: definition.category, name: record.name,
      publicPurpose: definition.publicPurpose, originCity: clone(originCity), roles: [...definition.roles], priorities: [...definition.priorities], prohibitions: [...definition.prohibitions],
      advertisedCapabilities: Object.fromEntries(CAPABILITY_KEYS.map((key, index) => [key, CAPABILITY_BANDS[parseInt(record.capabilityCodes[index], 36)]])),
      publicReputation: CAPABILITY_BANDS[parseInt(record.reputationCode, 36)], orbitalRoles: [...definition.orbitalRoles],
      internetReach: "globallyAddressableViaOrbitalArcaneMesh", physicalAuthority: "localSitesAndContractedAssetsOnly", sovereignAuthority: false,
      guaranteesLongRangeMaterialSupport: false, automaticEnforcementAuthority: false,
      themeContent: { definitionId: definition.id, sourceTheme: definition.compatibility, contentTags: [...definition.contentTags] }
    };
  }

  function expandBranch(code, directory, map, expandedNetworks) {
    const cityIndex = parseInt(code.slice(0, 2), 36);
    const networkIndex = parseInt(code[2], 36);
    const network = expandedNetworks[networkIndex];
    const city = map.humanGeography.cities[cityIndex];
    return {
      id: `network-branch:${cityIndex.toString(36)}:${networkIndex.toString(36)}`, cityId: city.id, networkId: network.id,
      publicName: `${network.name} — ${city.name} ${BRANCH_FORMS[parseInt(code[3], 36)].replace(/([a-z])([A-Z])/g, "$1 $2")}`,
      organizationForm: BRANCH_FORMS[parseInt(code[3], 36)], standing: STANDING_BY_CODE[directory.standingRows[cityIndex][networkIndex]],
      capacityBand: BRANCH_CAPACITY_BANDS[parseInt(code[4], 36)], serviceReliability: SERVICE_RELIABILITY_BANDS[parseInt(code[5], 36)],
      internetConnection: "globalOrbitalArcaneMesh", physicalScope: "thisCityAndContractedLocalAssetsOnly", sovereignAuthority: false,
      longRangeDeliveryGuaranteed: false, enforcementAuthority: false
    };
  }

  function expandAffiliate(code, directory, map, expandedNetworks) {
    const networkIndex = parseInt(code[0], 36);
    const ordinal = parseInt(code[1], 36);
    const cityIndex = parseInt(code.slice(2, 4), 36);
    const activityIndex = parseInt(code[4], 36);
    const disclosure = AFFILIATE_DISCLOSURES[parseInt(code[5], 36)];
    const network = expandedNetworks[networkIndex];
    const suffix = ["Services", "Materials", "Consulting", "Systems", "Leasing", "Telemetry", "Logistics"][(activityIndex + ordinal) % 7];
    return {
      id: `network-affiliate:${networkIndex.toString(36)}:${ordinal.toString(36)}`,
      registeredName: `${network.name.split(" ").slice(0, 2).join(" ")} ${suffix}`,
      registrationCityId: map.humanGeography.cities[cityIndex].id,
      declaredActivity: DECLARED_ACTIVITIES[activityIndex], ownershipDisclosure: disclosure,
      disclosedParentNetworkId: disclosure === "disclosedSubsidiary" ? network.id : null,
      playerOrOriginalScientistOwned: false
    };
  }

  function cellFeatures(map, directory) {
    const features = [];
    const expandedNetworks = directory.networkRecords.map((record) => expandNetwork(record, directory, map));
    for (let cityIndex = 0; cityIndex < map.humanGeography.cities.length; cityIndex += 1) {
      const branches = directory.publicBranchCodes.filter((code) => parseInt(code.slice(0, 2), 36) === cityIndex);
      if (!branches.length) continue;
      const orbitalHub = branches.some((code) => ["launchOffice", "orbitalRelayGateway"].includes(BRANCH_FORMS[parseInt(code[3], 36)]) && expandedNetworks[parseInt(code[2], 36)].orbitalRoles.length && parseInt(code[4], 36) >= 3);
      const featureClass = orbitalHub ? "o" : (branches.length >= 10 ? "d" : "b");
      features.push(`${StrategicWorld.cellIndex(map.humanGeography.cities[cityIndex].cellId).toString(36)}:${featureClass}`);
    }
    return features.sort((left, right) => parseInt(left, 36) - parseInt(right, 36));
  }

  function networksCore(record) {
    return {
      sourceHumanGeographyDigest: record.sourceHumanGeographyDigest, sourceCityRecognitionDigest: record.sourceCityRecognitionDigest,
      sourceReligionsDigest: record.sourceReligionsDigest, sourceCapabilityHistoryDigest: record.sourceCapabilityHistoryDigest,
      publicDirectoryDigest: record.publicDirectoryDigest,
      covertPresenceCodes: record.covertPresenceCodes, hiddenNetworkStateCodes: record.hiddenNetworkStateCodes,
      hiddenAffiliatePurposeCodes: record.hiddenAffiliatePurposeCodes, hiddenInfluenceCodes: record.hiddenInfluenceCodes, diagnostics: record.diagnostics
    };
  }

  function createStrategicNonStateNetworks(worldSeed, map) {
    const seed = String(worldSeed || "").trim();
    if (!seed) throw new Error("A world seed is required for non-state network generation.");
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicReligions.validateStrategicReligions(strategicMap);
    StrategicCapabilityHistory.validateStrategicCapabilityHistory(strategicMap);
    const worldTheme = strategicMap.cityPolities.worldTheme;
    const networkRecords = createNetworkRecords(seed, strategicMap, worldTheme);
    const standingRows = createStandingRows(seed, strategicMap, networkRecords);
    const publicBranchCodes = createPublicBranchCodes(seed, strategicMap, networkRecords, standingRows);
    const affiliateCodes = createAffiliateCodes(seed, strategicMap, networkRecords);
    const publicDirectory = {
      worldTheme, internetBaseline: clone(strategicMap.publicCapabilityHistory.currentBaseline.internet), spaceflightBaseline: clone(strategicMap.publicCapabilityHistory.currentBaseline.spaceflight), networkRecords,
      networkOrder: networkRecords.map((record) => record.id), cityOrder: strategicMap.humanGeography.cities.map((city) => city.id),
      standingRows, publicBranchCodes, publicRelationCodes: createPublicRelationCodes(seed, networkRecords), affiliateCodes
    };
    publicDirectory.cellFeatures = cellFeatures(strategicMap, publicDirectory);
    publicDirectory.digest = `public-non-state-networks-${StrategicWorld.stableHash(publicDirectory)}`;
    const hidden = createHiddenRecords(seed, strategicMap, networkRecords, affiliateCodes, standingRows);
    const record = {
      sourceHumanGeographyDigest: strategicMap.humanGeography.digest,
      sourceCityRecognitionDigest: strategicMap.crossCityRecognition.digest,
      sourceReligionsDigest: strategicMap.strategicReligions.digest,
      sourceCapabilityHistoryDigest: strategicMap.strategicCapabilityHistory.digest,
      publicDirectoryDigest: publicDirectory.digest,
      ...hidden,
      diagnostics: {
        networkCount: networkRecords.length, categoryCount: NETWORK_CATEGORIES.length, publicBranchCount: publicBranchCodes.length,
        covertCellCount: hidden.covertPresenceCodes.length, affiliateCount: affiliateCodes.length,
        publicRelationCount: publicDirectory.publicRelationCodes.length, orbitalNetworkCount: networkRecords.filter((entry) => DEFINITION_BY_ID.get(entry.definitionId).orbitalRoles.length).length
      }
    };
    record.digest = `strategic-non-state-networks-${StrategicWorld.stableHash(networksCore(record))}`;
    return { strategicNonStateNetworks: record, publicDirectory };
  }

  function publicNonStateNetworkDirectory(map) {
    if (!map?.publicNonStateNetworkDirectory) return null;
    const compact = map.publicNonStateNetworkDirectory;
    const directory = clone(compact);
    directory.networks = compact.networkRecords.map((record) => expandNetwork(record, compact, map));
    directory.branches = compact.publicBranchCodes.map((code) => expandBranch(code, compact, map, directory.networks));
    directory.relationships = compact.publicRelationCodes.map((code) => ({
      id: `network-relation:${code[0]}:${code[1]}`, networkIds: [directory.networks[parseInt(code[0], 36)].id, directory.networks[parseInt(code[1], 36)].id],
      relation: PUBLIC_RELATIONS[parseInt(code[2], 36)], createsSovereignty: false, guaranteesMaterialSupport: false
    }));
    directory.affiliates = compact.affiliateCodes.map((code) => expandAffiliate(code, compact, map, directory.networks));
    delete directory.networkRecords;
    delete directory.publicBranchCodes;
    delete directory.publicRelationCodes;
    delete directory.affiliateCodes;
    return directory;
  }

  function cityNetworkProfile(map, cityId) {
    const compact = map?.publicNonStateNetworkDirectory;
    const cityIndex = compact?.cityOrder.indexOf(cityId) ?? -1;
    if (cityIndex < 0) return null;
    const directory = publicNonStateNetworkDirectory(map);
    return {
      city: clone(map.humanGeography.cities[cityIndex]),
      standings: directory.networks.map((network, networkIndex) => ({
        network, standing: STANDING_BY_CODE[compact.standingRows[cityIndex][networkIndex]],
        branch: directory.branches.find((branch) => branch.cityId === cityId && branch.networkId === network.id) || null
      })),
      orbitalInfrastructure: directory.branches.filter((branch) => branch.cityId === cityId && ["launchOffice", "orbitalRelayGateway"].includes(branch.organizationForm) && directory.networks.find((network) => network.id === branch.networkId)?.orbitalRoles.length)
    };
  }

  function cellPublicNetworkSnapshot(map, index) {
    if (!map?.publicNonStateNetworkDirectory || !Number.isInteger(index) || index < 0 || index >= map.topology.cellCount) return null;
    const city = map.humanGeography.cities.find((entry) => StrategicWorld.cellIndex(entry.cellId) === index);
    const entry = map.publicNonStateNetworkDirectory.cellFeatures.find((feature) => parseInt(feature, 36) === index);
    return {
      cellId: StrategicWorld.cellId(index),
      publicClass: ({ b: "publicNetworkBranches", d: "denseInstitutionalHub", o: "orbitalLaunchOrRelayHub" })[entry?.split(":")[1]] || "noMajorPublicNetworkHub",
      cityProfile: city ? cityNetworkProfile(map, city.id) : null
    };
  }

  function hiddenNetworkStateFor(map, networkId) {
    const compact = map?.publicNonStateNetworkDirectory;
    const record = map?.strategicNonStateNetworks;
    const networkIndex = compact?.networkOrder.indexOf(networkId) ?? -1;
    if (networkIndex < 0 || !record) return null;
    const code = record.hiddenNetworkStateCodes.slice(networkIndex * 3, networkIndex * 3 + 3);
    return {
      networkId, actualCapacityBand: CAPABILITY_BANDS[parseInt(code[0], 36)], institutionalIntegrityBand: CAPABILITY_BANDS[parseInt(code[1], 36)],
      privatePriority: HIDDEN_PRIORITIES[parseInt(code[2], 36)], covertCells: record.covertPresenceCodes.filter((entry) => parseInt(entry[2], 36) === networkIndex).map((entry) => ({ cityId: map.humanGeography.cities[parseInt(entry.slice(0, 2), 36)].id, kind: COVERT_CELL_KINDS[parseInt(entry[3], 36)] })),
      publicInferencePermitted: false
    };
  }

  function validateStrategicNonStateNetworks(map, record = map?.strategicNonStateNetworks, publicDirectory = map?.publicNonStateNetworkDirectory) {
    const strategicMap = StrategicWorld.validateStrategicMap(map);
    StrategicReligions.validateStrategicReligions(strategicMap);
    StrategicCapabilityHistory.validateStrategicCapabilityHistory(strategicMap);
    if (!record || !publicDirectory || record.sourceHumanGeographyDigest !== strategicMap.humanGeography.digest || record.sourceCityRecognitionDigest !== strategicMap.crossCityRecognition.digest || record.sourceReligionsDigest !== strategicMap.strategicReligions.digest || record.sourceCapabilityHistoryDigest !== strategicMap.strategicCapabilityHistory.digest || record.publicDirectoryDigest !== publicDirectory.digest) throw new Error("Non-state network records are incomplete or do not match their source world.");
    const records = publicDirectory.networkRecords;
    if (!Array.isArray(records) || records.length !== 21 || new Set(records.map((entry) => entry.id)).size !== records.length || records.some((entry) => !DEFINITION_BY_ID.has(entry.definitionId) || !/^[0-4]{7}$/.test(entry.capabilityCodes) || !/^[0-4]$/.test(entry.reputationCode) || !strategicMap.humanGeography.cities[entry.originCityIndex])) throw new Error("Public network records are invalid.");
    const expanded = records.map((entry) => expandNetwork(entry, publicDirectory, strategicMap));
    if (NETWORK_CATEGORIES.some((category) => expanded.filter((network) => network.category === category).length !== 3) || expanded.some((network) => network.sovereignAuthority || network.automaticEnforcementAuthority || network.guaranteesLongRangeMaterialSupport || network.physicalAuthority !== "localSitesAndContractedAssetsOnly")) throw new Error("Every required non-state category needs three non-sovereign networks with bounded physical reach.");
    const allowedThemes = strategicMap.cityPolities.worldTheme === "unbound" ? ["shared", "madcap", "grim"] : ["shared", strategicMap.cityPolities.worldTheme];
    if (expanded.some((network) => !allowedThemes.includes(network.themeContent.sourceTheme))) throw new Error("Network theme content is incompatible with the world theme.");
    if (JSON.stringify(publicDirectory.internetBaseline) !== JSON.stringify(strategicMap.publicCapabilityHistory.currentBaseline.internet) || JSON.stringify(publicDirectory.spaceflightBaseline) !== JSON.stringify(strategicMap.publicCapabilityHistory.currentBaseline.spaceflight)) throw new Error("Global internet or spaceflight capability is not projected from capability history.");
    if (publicDirectory.cityOrder.length !== strategicMap.humanGeography.cities.length || JSON.stringify(publicDirectory.cityOrder) !== JSON.stringify(strategicMap.humanGeography.cities.map((city) => city.id)) || publicDirectory.networkOrder.length !== records.length || JSON.stringify(publicDirectory.networkOrder) !== JSON.stringify(records.map((entry) => entry.id))) throw new Error("Network directory order is invalid.");
    if (!Array.isArray(publicDirectory.standingRows) || publicDirectory.standingRows.length !== publicDirectory.cityOrder.length || publicDirectory.standingRows.some((row) => typeof row !== "string" || row.length !== records.length || /[^clrtxp]/.test(row))) throw new Error("Every city must publish a valid standing for every known network.");
    const branchCodes = publicDirectory.publicBranchCodes;
    if (!Array.isArray(branchCodes) || new Set(branchCodes.map((code) => code.slice(0, 3))).size !== branchCodes.length || branchCodes.some((code) => !/^[0-9a-z]{6}$/.test(code) || parseInt(code.slice(0, 2), 36) >= publicDirectory.cityOrder.length || parseInt(code[2], 36) >= records.length || parseInt(code[3], 36) >= BRANCH_FORMS.length || parseInt(code[4], 36) >= BRANCH_CAPACITY_BANDS.length || parseInt(code[5], 36) >= SERVICE_RELIABILITY_BANDS.length || publicDirectory.standingRows[parseInt(code.slice(0, 2), 36)][parseInt(code[2], 36)] === "p")) throw new Error("Public network branch records are invalid.");
    for (let cityIndex = 0; cityIndex < publicDirectory.cityOrder.length; cityIndex += 1) for (let networkIndex = 0; networkIndex < records.length; networkIndex += 1) if (["c", "l", "r"].includes(publicDirectory.standingRows[cityIndex][networkIndex]) && !branchCodes.some((code) => parseInt(code.slice(0, 2), 36) === cityIndex && parseInt(code[2], 36) === networkIndex)) throw new Error("Chartered, licensed, and recognized networks require a public local branch.");
    if (expanded.filter((network) => network.category !== "blackMarket").some((network) => branchCodes.filter((code) => records[parseInt(code[2], 36)].id === network.id).length < 2)) throw new Error("Public non-state networks must be physically present in multiple cities.");
    if (!Array.isArray(publicDirectory.publicRelationCodes) || new Set(publicDirectory.publicRelationCodes.map((code) => code.slice(0, 2))).size !== publicDirectory.publicRelationCodes.length || publicDirectory.publicRelationCodes.some((code) => !/^[0-9a-z]{3}$/.test(code) || parseInt(code[0], 36) >= records.length || parseInt(code[1], 36) >= records.length || parseInt(code[0], 36) >= parseInt(code[1], 36) || parseInt(code[2], 36) >= PUBLIC_RELATIONS.length)) throw new Error("Public inter-network relationships are invalid.");
    const affiliateCodes = publicDirectory.affiliateCodes;
    if (!Array.isArray(affiliateCodes) || affiliateCodes.length !== 15 || new Set(affiliateCodes.map((code) => code.slice(0, 2))).size !== affiliateCodes.length || affiliateCodes.some((code) => !/^[0-9a-z]{6}$/.test(code) || parseInt(code[0], 36) >= records.length || parseInt(code.slice(2, 4), 36) >= publicDirectory.cityOrder.length || parseInt(code[4], 36) >= DECLARED_ACTIVITIES.length || parseInt(code[5], 36) >= AFFILIATE_DISCLOSURES.length)) throw new Error("Corporate affiliate records are invalid.");
    const hiddenStateCodesValid = typeof record.hiddenNetworkStateCodes === "string" && record.hiddenNetworkStateCodes.length === records.length * 3 && records.every((entry, index) => /^[0-4]{2}[0-5]$/.test(record.hiddenNetworkStateCodes.slice(index * 3, index * 3 + 3)));
    const covertCodesValid = Array.isArray(record.covertPresenceCodes) && new Set(record.covertPresenceCodes.map((code) => code.slice(0, 3))).size === record.covertPresenceCodes.length && record.covertPresenceCodes.every((code) => /^[0-9a-z]{4}$/.test(code) && parseInt(code.slice(0, 2), 36) < publicDirectory.cityOrder.length && parseInt(code[2], 36) < records.length && parseInt(code[3], 36) < COVERT_CELL_KINDS.length);
    const hiddenInfluenceCodesValid = Array.isArray(record.hiddenInfluenceCodes) && new Set(record.hiddenInfluenceCodes.map((code) => code.slice(0, 2))).size === record.hiddenInfluenceCodes.length && record.hiddenInfluenceCodes.every((code) => /^[0-9a-z]{3}$/.test(code) && parseInt(code[0], 36) < records.length && parseInt(code[1], 36) < records.length && parseInt(code[0], 36) < parseInt(code[1], 36) && parseInt(code[2], 36) < HIDDEN_INFLUENCE_KINDS.length);
    if (!hiddenStateCodesValid || typeof record.hiddenAffiliatePurposeCodes !== "string" || record.hiddenAffiliatePurposeCodes.length !== affiliateCodes.length || /[^0-5]/.test(record.hiddenAffiliatePurposeCodes) || !covertCodesValid || !hiddenInfluenceCodesValid) throw new Error("Hidden network records are invalid.");
    const blackMarketIds = new Set(expanded.filter((network) => network.category === "blackMarket").map((network) => network.id));
    if ([...blackMarketIds].some((id) => record.covertPresenceCodes.filter((code) => records[parseInt(code[2], 36)].id === id).length < 2)) throw new Error("Every black-market network requires a cross-city covert footprint.");
    if (Object.keys(publicDirectory).some((key) => key.startsWith("hidden") || key.includes("covertPresence")) || JSON.stringify(publicDirectory).includes("actualCapacityBand") || JSON.stringify(publicDirectory).includes("privatePriority")) throw new Error("The public network directory leaks covert facts.");
    if (!Array.isArray(publicDirectory.cellFeatures) || JSON.stringify(publicDirectory.cellFeatures) !== JSON.stringify(cellFeatures(strategicMap, publicDirectory))) throw new Error("The public network globe projection is invalid.");
    const diagnostics = record.diagnostics;
    if (!diagnostics || diagnostics.networkCount !== records.length || diagnostics.categoryCount !== NETWORK_CATEGORIES.length || diagnostics.publicBranchCount !== branchCodes.length || diagnostics.covertCellCount !== record.covertPresenceCodes.length || diagnostics.affiliateCount !== affiliateCodes.length || diagnostics.publicRelationCount !== publicDirectory.publicRelationCodes.length || diagnostics.orbitalNetworkCount !== expanded.filter((network) => network.orbitalRoles.length).length) throw new Error("Non-state network diagnostics do not match saved facts.");
    const publicCore = clone(publicDirectory); delete publicCore.digest;
    if (publicDirectory.digest !== `public-non-state-networks-${StrategicWorld.stableHash(publicCore)}` || record.digest !== `strategic-non-state-networks-${StrategicWorld.stableHash(networksCore(record))}`) throw new Error("Non-state network records do not match their digests.");
    return { strategicNonStateNetworks: clone(record), publicDirectory: clone(publicDirectory) };
  }

  function attachStrategicNonStateNetworks(worldSeed, map) {
    const next = StrategicWorld.validateStrategicMap(map);
    const generated = createStrategicNonStateNetworks(worldSeed, next);
    next.strategicNonStateNetworks = generated.strategicNonStateNetworks;
    next.publicNonStateNetworkDirectory = generated.publicDirectory;
    return StrategicWorld.finalizeStrategicMap(next);
  }

  function auditStrategicNonStateNetworks(map) {
    const { strategicNonStateNetworks, publicDirectory } = validateStrategicNonStateNetworks(map);
    const expanded = publicNonStateNetworkDirectory(map);
    return {
      valid: true, networkCount: expanded.networks.length, everyCategoryPresent: NETWORK_CATEGORIES.every((category) => expanded.networks.some((network) => network.category === category)),
      everyNetworkNonSovereign: expanded.networks.every((network) => !network.sovereignAuthority && !network.automaticEnforcementAuthority),
      physicalReachLocallyBound: expanded.branches.every((branch) => branch.physicalScope === "thisCityAndContractedLocalAssetsOnly" && !branch.longRangeDeliveryGuaranteed),
      globalInternetUsesOrbitalArcaneMesh: publicDirectory.internetBaseline.architecture === "orbitalSatelliteConstellationWithArcaneRelayMesh" && publicDirectory.internetBaseline.orbitalSatellites && publicDirectory.internetBaseline.arcaneRelayLinks,
      rocketSpaceflightExists: publicDirectory.spaceflightBaseline.rocketSpaceflight,
      individualSpaceflightExists: publicDirectory.spaceflightBaseline.individuallyPoweredSpaceflight,
      cityStandingComplete: publicDirectory.standingRows.every((row) => row.length === expanded.networks.length),
      shellOwnershipSeparated: expanded.affiliates.every((affiliate) => !affiliate.playerOrOriginalScientistOwned) && strategicNonStateNetworks.hiddenAffiliatePurposeCodes.length === expanded.affiliates.length,
      publicDirectoryHidesCovertCells: !JSON.stringify(publicDirectory).includes("covertPresence") && !JSON.stringify(publicDirectory).includes("actualCapacityBand"),
      playerCompanyExcludedFromCanonicalWorld: expanded.affiliates.every((affiliate) => !affiliate.playerOrOriginalScientistOwned),
      diagnostics: clone(strategicNonStateNetworks.diagnostics)
    };
  }

  return Object.freeze({
    NETWORK_CATEGORIES, CAPABILITY_KEYS, CAPABILITY_BANDS, CITY_STANDINGS, BRANCH_FORMS, PUBLIC_RELATIONS, NETWORK_DEFINITIONS,
    INTERNET_BASELINE, SPACEFLIGHT_BASELINE, createStrategicNonStateNetworks, validateStrategicNonStateNetworks,
    attachStrategicNonStateNetworks, publicNonStateNetworkDirectory, cityNetworkProfile, cellPublicNetworkSnapshot, hiddenNetworkStateFor, auditStrategicNonStateNetworks
  });
});
