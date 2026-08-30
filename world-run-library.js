(function initWorldRunLibrary(root, factory) {
  const themeContent = typeof module === "object" && module.exports
    ? require("./theme-content")
    : root?.HelixThemeContent;
  const strategicWorld = typeof module === "object" && module.exports
    ? require("./strategic-world")
    : root?.HelixStrategicWorld;
  const planetaryRelief = typeof module === "object" && module.exports
    ? require("./planetary-relief")
    : root?.HelixPlanetaryRelief;
  const climateHydrologyBiomes = typeof module === "object" && module.exports
    ? require("./climate-hydrology-biomes")
    : root?.HelixClimateHydrologyBiomes;
  const strategicGeology = typeof module === "object" && module.exports
    ? require("./strategic-geology")
    : root?.HelixStrategicGeology;
  const strategicArcaneGeography = typeof module === "object" && module.exports
    ? require("./strategic-arcane-geography")
    : root?.HelixStrategicArcaneGeography;
  const strategicResourcePotential = typeof module === "object" && module.exports
    ? require("./strategic-resource-potential")
    : root?.HelixStrategicResourcePotential;
  const strategicHumanGeography = typeof module === "object" && module.exports
    ? require("./strategic-human-geography")
    : root?.HelixStrategicHumanGeography;
  const strategicCityPolities = typeof module === "object" && module.exports
    ? require("./strategic-city-polities")
    : root?.HelixStrategicCityPolities;
  const strategicBeastEcology = typeof module === "object" && module.exports
    ? require("./strategic-beast-ecology")
    : root?.HelixStrategicBeastEcology;
  const strategicPreUrbanHumanity = typeof module === "object" && module.exports
    ? require("./strategic-pre-urban-humanity")
    : root?.HelixStrategicPreUrbanHumanity;
  const strategicCityGovernments = typeof module === "object" && module.exports
    ? require("./strategic-city-governments")
    : root?.HelixStrategicCityGovernments;
  const strategicCityLaws = typeof module === "object" && module.exports
    ? require("./strategic-city-laws")
    : root?.HelixStrategicCityLaws;
  const strategicCityRecognition = typeof module === "object" && module.exports
    ? require("./strategic-city-recognition")
    : root?.HelixStrategicCityRecognition;
  const strategicReligions = typeof module === "object" && module.exports
    ? require("./strategic-religions")
    : root?.HelixStrategicReligions;
  const strategicDivinity = typeof module === "object" && module.exports
    ? require("./strategic-divinity")
    : root?.HelixStrategicDivinity;
  const strategicFaiths = typeof module === "object" && module.exports
    ? require("./strategic-faiths")
    : root?.HelixStrategicFaiths;
  const strategicCivilizationOrigins = typeof module === "object" && module.exports
    ? require("./strategic-civilization-origins")
    : root?.HelixStrategicCivilizationOrigins;
  const strategicCityExpansion = typeof module === "object" && module.exports
    ? require("./strategic-city-expansion")
    : root?.HelixStrategicCityExpansion;
  const strategicCapabilityHistory = typeof module === "object" && module.exports
    ? require("./strategic-capability-history")
    : root?.HelixStrategicCapabilityHistory;
  const strategicNonStateNetworks = typeof module === "object" && module.exports
    ? require("./strategic-non-state-networks")
    : root?.HelixStrategicNonStateNetworks;
  const strategicSettlements = typeof module === "object" && module.exports
    ? require("./strategic-settlements")
    : root?.HelixStrategicSettlements;
  const strategicDivineHistory = typeof module === "object" && module.exports
    ? require("./strategic-divine-history")
    : root?.HelixStrategicDivineHistory;
  const strategicCrisisHistory = typeof module === "object" && module.exports
    ? require("./strategic-crisis-history")
    : root?.HelixStrategicCrisisHistory;
  const strategicPoliticalHistory = typeof module === "object" && module.exports
    ? require("./strategic-political-history")
    : root?.HelixStrategicPoliticalHistory;
  const strategicCivicHistory = typeof module === "object" && module.exports
    ? require("./strategic-civic-history")
    : root?.HelixStrategicCivicHistory;
  const strategicLegalHistory = typeof module === "object" && module.exports
    ? require("./strategic-legal-history")
    : root?.HelixStrategicLegalHistory;
  const api = factory(themeContent, strategicWorld, planetaryRelief, climateHydrologyBiomes, strategicGeology, strategicArcaneGeography, strategicResourcePotential, strategicHumanGeography, strategicCityPolities, strategicBeastEcology, strategicPreUrbanHumanity, strategicCityGovernments, strategicCityLaws, strategicCityRecognition, strategicReligions, strategicDivinity, strategicFaiths, strategicCivilizationOrigins, strategicCityExpansion, strategicCapabilityHistory, strategicNonStateNetworks, strategicSettlements, strategicDivineHistory, strategicCrisisHistory, strategicPoliticalHistory, strategicCivicHistory, strategicLegalHistory);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixWorldRunLibrary = api;
})(typeof window !== "undefined" ? window : globalThis, function createWorldRunLibraryApi(ThemeContent, StrategicWorld, PlanetaryRelief, ClimateHydrologyBiomes, StrategicGeology, StrategicArcaneGeography, StrategicResourcePotential, StrategicHumanGeography, StrategicCityPolities, StrategicBeastEcology, StrategicPreUrbanHumanity, StrategicCityGovernments, StrategicCityLaws, StrategicCityRecognition, StrategicReligions, StrategicDivinity, StrategicFaiths, StrategicCivilizationOrigins, StrategicCityExpansion, StrategicCapabilityHistory, StrategicNonStateNetworks, StrategicSettlements, StrategicDivineHistory, StrategicCrisisHistory, StrategicPoliticalHistory, StrategicCivicHistory, StrategicLegalHistory) {
  "use strict";

  if (!ThemeContent) throw new Error("HelixThemeContent must load before world-run-library.js");
  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before world-run-library.js");
  if (!PlanetaryRelief) throw new Error("HelixPlanetaryRelief must load before world-run-library.js");
  if (!ClimateHydrologyBiomes) throw new Error("HelixClimateHydrologyBiomes must load before world-run-library.js");
  if (!StrategicGeology) throw new Error("HelixStrategicGeology must load before world-run-library.js");
  if (!StrategicArcaneGeography) throw new Error("HelixStrategicArcaneGeography must load before world-run-library.js");
  if (!StrategicResourcePotential) throw new Error("HelixStrategicResourcePotential must load before world-run-library.js");
  if (!StrategicHumanGeography) throw new Error("HelixStrategicHumanGeography must load before world-run-library.js");
  if (!StrategicCityPolities) throw new Error("HelixStrategicCityPolities must load before world-run-library.js");
  if (!StrategicBeastEcology) throw new Error("HelixStrategicBeastEcology must load before world-run-library.js");
  if (!StrategicPreUrbanHumanity) throw new Error("HelixStrategicPreUrbanHumanity must load before world-run-library.js");
  if (!StrategicCityGovernments) throw new Error("HelixStrategicCityGovernments must load before world-run-library.js");
  if (!StrategicCityLaws) throw new Error("HelixStrategicCityLaws must load before world-run-library.js");
  if (!StrategicCityRecognition) throw new Error("HelixStrategicCityRecognition must load before world-run-library.js");
  if (!StrategicReligions) throw new Error("HelixStrategicReligions must load before world-run-library.js");
  if (!StrategicDivinity) throw new Error("HelixStrategicDivinity must load before world-run-library.js");
  if (!StrategicFaiths) throw new Error("HelixStrategicFaiths must load before world-run-library.js");
  if (!StrategicCivilizationOrigins) throw new Error("HelixStrategicCivilizationOrigins must load before world-run-library.js");
  if (!StrategicCityExpansion) throw new Error("HelixStrategicCityExpansion must load before world-run-library.js");
  if (!StrategicCapabilityHistory) throw new Error("HelixStrategicCapabilityHistory must load before world-run-library.js");
  if (!StrategicNonStateNetworks) throw new Error("HelixStrategicNonStateNetworks must load before world-run-library.js");
  if (!StrategicSettlements) throw new Error("HelixStrategicSettlements must load before world-run-library.js");
  if (!StrategicDivineHistory) throw new Error("HelixStrategicDivineHistory must load before world-run-library.js");
  if (!StrategicCrisisHistory) throw new Error("HelixStrategicCrisisHistory must load before world-run-library.js");
  if (!StrategicPoliticalHistory) throw new Error("HelixStrategicPoliticalHistory must load before world-run-library.js");
  if (!StrategicCivicHistory) throw new Error("HelixStrategicCivicHistory must load before world-run-library.js");
  if (!StrategicLegalHistory) throw new Error("HelixStrategicLegalHistory must load before world-run-library.js");

  const LIBRARY_VERSION = 2;
  const WORLD_RECORD_VERSION = 1;
  const RUN_RECORD_VERSION = 1;
  const WORLD_GENERATION_VERSION = 9;
  const WORLD_NAME_VERSION = 2;
  const MANIFEST_KEY = "helix-heresy-v2-library";
  const WORLD_KEY_PREFIX = "helix-heresy-v2-world:";
  const RUN_KEY_PREFIX = "helix-heresy-v2-run:";
  const THEMES = ThemeContent.WORLD_THEMES;

  const WORLD_NAME_OPENINGS = Object.freeze([
    "Aether", "Ash", "Aurora", "Brass", "Cinder", "Cloud", "Ember", "Glass",
    "Helix", "Iron", "Lumen", "Moon", "Night", "Rune", "Star", "Storm"
  ]);
  const WORLD_NAME_ENDINGS = Object.freeze([
    "fall", "gard", "hollow", "mere", "reach", "rest", "spire", "tide",
    "vale", "veil", "ward", "weald", "wilds", "wold", "wyn", "zenith"
  ]);
  const WORLD_NAME_TITLES = Object.freeze([
    "The Boundless Experiment", "The Crowned Expanse", "The Many-Walled World",
    "The Realm Beneath Strange Stars", "The Shattered Firmament", "The Untamed Sphere"
  ]);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function cleanSeed(value) {
    return String(value || "").trim().replace(/\s+/g, "-").slice(0, 80);
  }

  function cleanId(value) {
    return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 96);
  }

  function stableHash(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function seededNumbers(seed) {
    let cursor = parseInt(stableHash(seed), 16) >>> 0;
    return function next() {
      cursor += 0x6d2b79f5;
      let value = cursor;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generatedWorldName(worldSeed, themeOrVersion = "madcap", requestedVersion = WORLD_NAME_VERSION) {
    const seed = cleanSeed(worldSeed);
    if (!seed) throw new Error("A world seed is required to generate a name.");
    const legacySignature = typeof themeOrVersion === "number";
    const worldTheme = legacySignature ? "madcap" : (THEMES[themeOrVersion] ? themeOrVersion : "madcap");
    const version = legacySignature ? themeOrVersion : requestedVersion;
    if (version >= 2) {
      const selected = ThemeContent.selectRenderedContent({
        kind: "worldName",
        worldTheme,
        seed: `${seed}:world-name:v${version}`
      });
      if (!selected.ok) throw new Error(`World name generation failed: ${selected.code}.`);
      return selected.text;
    }
    const rng = seededNumbers(`${seed}:world-name:v${version}`);
    const opening = WORLD_NAME_OPENINGS[Math.floor(rng() * WORLD_NAME_OPENINGS.length)];
    const ending = WORLD_NAME_ENDINGS[Math.floor(rng() * WORLD_NAME_ENDINGS.length)];
    const title = WORLD_NAME_TITLES[Math.floor(rng() * WORLD_NAME_TITLES.length)];
    return `${opening}${ending}, ${title}`;
  }

  function generatedPlayableYear(worldSeed, generationVersion = WORLD_GENERATION_VERSION) {
    const rng = seededNumbers(`${cleanSeed(worldSeed)}:playable-year:v${generationVersion}`);
    return 700 + Math.floor(rng() * 1700);
  }

  function worldCanonicalCore(candidate) {
    return {
      worldSeed: cleanSeed(candidate.worldSeed),
      generationVersion: Math.max(1, Math.floor(Number(candidate.generationVersion) || WORLD_GENERATION_VERSION)),
      nameGeneratorVersion: Math.max(1, Math.floor(Number(candidate.nameGeneratorVersion) || WORLD_NAME_VERSION)),
      name: String(candidate.name || "").trim(),
      worldTheme: THEMES[candidate.worldTheme] ? candidate.worldTheme : "madcap",
      creationSettings: clone(candidate.creationSettings || {}),
      playableYear: Math.floor(Number(candidate.playableYear) || 0),
      summary: String(candidate.summary || "").trim(),
      generatedData: clone(candidate.generatedData || {})
    };
  }

  function canonicalWorldDigest(candidate) {
    return `world-${stableHash(worldCanonicalCore(candidate))}`;
  }

  function createWorld(options = {}) {
    const worldSeed = cleanSeed(options.worldSeed);
    const id = cleanId(options.id);
    if (!id) throw new Error("A stable world ID is required.");
    if (!worldSeed) throw new Error("A world seed is required.");
    const worldTheme = THEMES[options.worldTheme] ? options.worldTheme : "madcap";
    const generationVersion = Math.max(1, Math.floor(Number(options.generationVersion) || WORLD_GENERATION_VERSION));
    const nameGeneratorVersion = Math.max(1, Math.floor(Number(options.nameGeneratorVersion) || WORLD_NAME_VERSION));
    const playableYear = Number.isFinite(Number(options.playableYear))
      ? Math.floor(Number(options.playableYear))
      : generatedPlayableYear(worldSeed, generationVersion);
    const nameSelection = nameGeneratorVersion >= 2
      ? ThemeContent.selectRenderedContent({
        kind: "worldName",
        worldTheme,
        seed: `${worldSeed}:world-name:v${nameGeneratorVersion}`
      })
      : null;
    const generatedName = nameSelection?.ok
      ? nameSelection.text
      : generatedWorldName(worldSeed, worldTheme, nameGeneratorVersion);
    const providedName = String(options.name || "").trim();
    const name = providedName || generatedName;
    const summarySelection = ThemeContent.selectRenderedContent({
      kind: "worldSummary",
      worldTheme,
      seed: `${worldSeed}:world-summary:v${ThemeContent.VERSION}`,
      context: { worldName: name, playableYear }
    });
    if (!summarySelection.ok && !options.summary) {
      throw new Error(`World summary generation failed: ${summarySelection.code}.`);
    }
    const providedSummary = String(options.summary || "").trim();
    const summary = providedSummary || summarySelection.text;
    const createdAt = String(options.createdAt || new Date().toISOString());
    let generatedData = clone(options.generatedData);
    if (!generatedData) {
      const baseStrategicMap = generationVersion >= 2
        ? StrategicWorld.createStrategicMap(worldSeed, options.creationSettings?.strategicMap)
        : null;
      let generatedStrategicMap = generationVersion >= 3
        ? PlanetaryRelief.attachRelief(worldSeed, baseStrategicMap, options.creationSettings?.relief)
        : baseStrategicMap;
      if (generationVersion >= 4) {
        generatedStrategicMap = ClimateHydrologyBiomes.attachEnvironment(worldSeed, generatedStrategicMap, options.creationSettings?.environment);
      }
      if (generationVersion >= 5) {
        generatedStrategicMap = StrategicGeology.attachGeology(worldSeed, generatedStrategicMap, options.creationSettings?.geology);
      }
      if (generationVersion >= 6) {
        generatedStrategicMap = StrategicArcaneGeography.attachArcaneGeography(worldSeed, generatedStrategicMap, options.creationSettings?.arcaneGeography);
      }
      if (generationVersion >= 7) {
        generatedStrategicMap = StrategicResourcePotential.attachResourcePotential(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicBeastEcology.attachPristineBeastEcology(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicPreUrbanHumanity.attachPreUrbanHumanity(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicDivinity.attachPreCivicDivinity(worldSeed, worldTheme, generatedStrategicMap);
        generatedStrategicMap = StrategicFaiths.attachPreCivicFaiths(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicCivilizationOrigins.attachCivilizationOrigins(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicCityExpansion.attachCityExpansionHistory(worldSeed, generatedStrategicMap, { historicalHorizonYear: playableYear });
        generatedStrategicMap = StrategicCapabilityHistory.attachStrategicCapabilityHistory(worldSeed, generatedStrategicMap, { historicalHorizonYear: playableYear });
      }
      if (generationVersion >= 8) {
        generatedStrategicMap = StrategicHumanGeography.attachHumanGeography(worldSeed, generatedStrategicMap, options.creationSettings?.humanGeography);
      }
      if (generationVersion >= 9) {
        generatedStrategicMap = StrategicCityPolities.attachCityPolities(worldSeed, worldTheme, generatedStrategicMap);
        generatedStrategicMap = StrategicBeastEcology.attachBeastEcology(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicCityGovernments.attachCityGovernments(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicCityLaws.attachCityLegalCodes(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicCityRecognition.attachCrossCityRecognition(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicReligions.attachStrategicReligions(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicNonStateNetworks.attachStrategicNonStateNetworks(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicSettlements.attachStrategicSettlements(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicDivineHistory.attachStrategicDivineHistory(worldSeed, generatedStrategicMap, { historicalHorizonYear: playableYear });
        generatedStrategicMap = StrategicCrisisHistory.attachStrategicCrisisHistory(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicPoliticalHistory.attachStrategicPoliticalHistory(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicCivicHistory.attachStrategicCivicHistory(worldSeed, generatedStrategicMap);
        generatedStrategicMap = StrategicLegalHistory.attachStrategicLegalHistory(worldSeed, generatedStrategicMap);
      }
      generatedData = generationVersion >= 2 ? {
        version: generationVersion,
        strategicResolution: generationVersion >= 9
          ? "geodesic-globe-city-polities"
          : generationVersion >= 8
          ? "geodesic-globe-fortified-cities"
          : generationVersion >= 7
          ? "geodesic-globe-resource-potential"
          : generationVersion >= 6
            ? "geodesic-globe-arcane-geography"
          : generationVersion >= 5
            ? "geodesic-globe-geology"
          : generationVersion >= 4
            ? "geodesic-globe-environment"
          : (generationVersion >= 3 ? "geodesic-globe-relief" : "geodesic-globe"),
        strategicMap: generatedStrategicMap,
        themeContent: {
          version: ThemeContent.VERSION,
          worldName: providedName ? null : ThemeContent.selectionRecord(nameSelection),
          worldSummary: providedSummary ? null : ThemeContent.selectionRecord(summarySelection)
        },
        canonicalState: {
          worldName: name,
          playableYear,
          worldTheme
        }
      } : {
        version: generationVersion,
        strategicResolution: "prototype",
        themeContent: {
          version: ThemeContent.VERSION,
          worldName: providedName ? null : ThemeContent.selectionRecord(nameSelection),
          worldSummary: providedSummary ? null : ThemeContent.selectionRecord(summarySelection)
        },
        canonicalState: {
          worldName: name,
          playableYear,
          worldTheme
        }
      };
    }
    if (generationVersion >= 2) StrategicWorld.validateStrategicMap(generatedData.strategicMap);
    if (generationVersion >= 3) PlanetaryRelief.validateRelief(generatedData.strategicMap);
    if (generationVersion >= 4) ClimateHydrologyBiomes.validateEnvironment(generatedData.strategicMap);
    if (generationVersion >= 5) StrategicGeology.validateStrategicGeology(generatedData.strategicMap);
    if (generationVersion >= 6) StrategicArcaneGeography.validateStrategicArcaneGeography(generatedData.strategicMap);
    if (generationVersion >= 7) StrategicResourcePotential.validateStrategicResources(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicDivinity || generatedData.strategicMap?.publicDivinityDirectory) StrategicDivinity.validatePreCivicDivinity(generatedData.strategicMap);
    if (generatedData.strategicMap?.preCivicFaiths || generatedData.strategicMap?.publicPreCivicFaithDirectory) StrategicFaiths.validatePreCivicFaiths(generatedData.strategicMap);
    if (generatedData.strategicMap?.civilizationOrigins || generatedData.strategicMap?.publicCivilizationOrigins) StrategicCivilizationOrigins.validateCivilizationOrigins(generatedData.strategicMap);
    if (generatedData.strategicMap?.cityExpansionHistory || generatedData.strategicMap?.publicCityExpansionDirectory) StrategicCityExpansion.validateCityExpansionHistory(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicCapabilityHistory || generatedData.strategicMap?.publicCapabilityHistory) StrategicCapabilityHistory.validateStrategicCapabilityHistory(generatedData.strategicMap);
    if (generatedData.strategicMap?.pristineBeastEcology) StrategicBeastEcology.validatePristineBeastEcology(generatedData.strategicMap);
    if (generatedData.strategicMap?.preUrbanHumanity || generatedData.strategicMap?.publicPreUrbanOverview) StrategicPreUrbanHumanity.validatePreUrbanHumanity(generatedData.strategicMap);
    if (generationVersion >= 8) StrategicHumanGeography.validateHumanGeography(generatedData.strategicMap);
    if (generationVersion >= 9) StrategicCityPolities.validateCityPolities(generatedData.strategicMap);
    if (generatedData.strategicMap?.beastEcology || generatedData.strategicMap?.publicBeastAtlas) StrategicBeastEcology.validateBeastEcology(generatedData.strategicMap);
    if (generatedData.strategicMap?.cityGovernments || generatedData.strategicMap?.publicCityGovernmentDirectory) StrategicCityGovernments.validateCityGovernments(generatedData.strategicMap);
    if (generatedData.strategicMap?.cityLegalCodes || generatedData.strategicMap?.publicCityLawDirectory) StrategicCityLaws.validateCityLegalCodes(generatedData.strategicMap);
    if (generatedData.strategicMap?.crossCityRecognition || generatedData.strategicMap?.publicCrossCityRecognitionDirectory) StrategicCityRecognition.validateCrossCityRecognition(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicReligions || generatedData.strategicMap?.publicReligionDirectory) StrategicReligions.validateStrategicReligions(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicNonStateNetworks || generatedData.strategicMap?.publicNonStateNetworkDirectory) StrategicNonStateNetworks.validateStrategicNonStateNetworks(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicSettlements || generatedData.strategicMap?.publicSettlementDirectory) StrategicSettlements.validateStrategicSettlements(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicDivineHistory || generatedData.strategicMap?.publicDivineHistoryDirectory) StrategicDivineHistory.validateStrategicDivineHistory(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicCrisisHistory || generatedData.strategicMap?.publicCrisisHistoryDirectory) StrategicCrisisHistory.validateStrategicCrisisHistory(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicPoliticalHistory || generatedData.strategicMap?.publicPoliticalHistoryDirectory) StrategicPoliticalHistory.validateStrategicPoliticalHistory(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicCivicHistory || generatedData.strategicMap?.publicCivicHistoryDirectory) StrategicCivicHistory.validateStrategicCivicHistory(generatedData.strategicMap);
    if (generatedData.strategicMap?.strategicLegalHistory || generatedData.strategicMap?.publicLegalHistoryDirectory) StrategicLegalHistory.validateStrategicLegalHistory(generatedData.strategicMap);
    const world = {
      recordVersion: WORLD_RECORD_VERSION,
      id,
      worldSeed,
      generationVersion,
      nameGeneratorVersion,
      name,
      worldTheme,
      creationSettings: {
        scale: generationVersion >= 2 ? "planetary-prototype" : "prototype",
        ...(generationVersion >= 2 ? {
          strategicMap: {
            refinementLevel: StrategicWorld.DEFAULT_REFINEMENT_LEVEL,
            radiusKm: StrategicWorld.DEFAULT_PLANET_RADIUS_KM,
            landFraction: StrategicWorld.DEFAULT_LAND_FRACTION
          }
        } : {}),
        ...(generationVersion >= 3 ? {
          relief: {
            plateCount: PlanetaryRelief.DEFAULT_PLATE_COUNT
          }
        } : {}),
        ...(generationVersion >= 4 ? {
          environment: {
            climate: {
              axialTiltMinimumDeg: ClimateHydrologyBiomes.AXIAL_TILT_MINIMUM_DEG,
              axialTiltMaximumDeg: ClimateHydrologyBiomes.AXIAL_TILT_MAXIMUM_DEG
            }
          }
        } : {}),
        ...(generationVersion >= 5 ? {
          geology: {
            provinceCellTarget: StrategicGeology.DEFAULT_PROVINCE_CELL_TARGET
          }
        } : {}),
        ...(generationVersion >= 6 ? {
          arcaneGeography: {
            fieldWaveCount: StrategicArcaneGeography.DEFAULT_FIELD_WAVE_COUNT,
            leyCellFraction: StrategicArcaneGeography.DEFAULT_LEY_CELL_FRACTION
          }
        } : {}),
        ...(generationVersion >= 8 ? {
          humanGeography: {
            cityCellsPerCity: StrategicHumanGeography.DEFAULT_CITY_CELLS_PER_CITY,
            minimumCityCount: StrategicHumanGeography.DEFAULT_MINIMUM_CITY_COUNT,
            maximumCityCount: StrategicHumanGeography.DEFAULT_MAXIMUM_CITY_COUNT,
            minimumCitySpacingKm: StrategicHumanGeography.DEFAULT_MINIMUM_CITY_SPACING_KM
          }
        } : {}),
        ...(clone(options.creationSettings) || {}),
        worldTheme
      },
      playableYear,
      summary,
      generatedData,
      createdAt
    };
    world.canonicalDigest = canonicalWorldDigest(world);
    return world;
  }

  function normalizeWorld(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("World record is invalid.");
    const world = createWorld(candidate);
    if (candidate.canonicalDigest && candidate.canonicalDigest !== world.canonicalDigest) {
      throw new Error("World canonical data does not match its digest.");
    }
    return world;
  }

  function createRun(options = {}) {
    const id = cleanId(options.id);
    const worldId = cleanId(options.worldId);
    const runSeed = cleanSeed(options.runSeed);
    if (!id || !worldId || !runSeed) throw new Error("Run ID, world ID, and run seed are required.");
    const createdAt = String(options.createdAt || new Date().toISOString());
    const status = options.status === "ended" ? "ended" : "active";
    return {
      recordVersion: RUN_RECORD_VERSION,
      id,
      worldId,
      worldGenerationVersion: Math.max(1, Math.floor(Number(options.worldGenerationVersion) || WORLD_GENERATION_VERSION)),
      canonicalWorldDigest: String(options.canonicalWorldDigest || ""),
      runSeed,
      scenario: clone(options.scenario) || null,
      site: clone(options.site) || null,
      worldState: clone(options.worldState) || {
        version: 1,
        canonicalWorldDigest: String(options.canonicalWorldDigest || ""),
        changes: {}
      },
      status,
      createdAt,
      updatedAt: String(options.updatedAt || createdAt),
      endedAt: status === "ended" ? String(options.endedAt || options.updatedAt || createdAt) : null,
      endReason: status === "ended" ? String(options.endReason || "death") : null,
      state: clone(options.state) || null
    };
  }

  function normalizeRun(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Run record is invalid.");
    return createRun(candidate);
  }

  function normalizeRunStorageRecord(id, candidate) {
    if (candidate?.id) return normalizeRun(candidate);
    const state = candidate?.state;
    const worldReference = state?.worldReference;
    const runIdentity = state?.runIdentity;
    if (!state || !worldReference?.worldId || !runIdentity?.runId) throw new Error("Run record is invalid.");
    if (cleanId(runIdentity.runId) !== cleanId(id)) throw new Error("Projected run state does not match its storage key.");
    const scenario = clone(state.startingScenario) || null;
    const canonicalDigest = String(worldReference.canonicalDigest || "");
    return createRun({
      id,
      worldId: worldReference.worldId,
      worldGenerationVersion: worldReference.generationVersion,
      canonicalWorldDigest: canonicalDigest,
      runSeed: runIdentity.runSeed || state.seed,
      scenario,
      site: scenario ? {
        id: `starting-site:${scenario.id}`,
        kind: "startingSite",
        strategicLocation: null,
        selectionStatus: "deferredWorldPlacement",
        blueprintId: scenario.blueprintId,
        blueprintVersion: scenario.blueprintVersion
      } : null,
      worldState: { version: 1, canonicalWorldDigest: canonicalDigest, changes: {} },
      status: state.runEnded ? "ended" : "active",
      createdAt: candidate.savedAt,
      updatedAt: candidate.savedAt,
      endedAt: state.runEnded ? candidate.savedAt : null,
      state
    });
  }

  function emptyManifest() {
    return {
      version: LIBRARY_VERSION,
      worldIds: [],
      runIds: [],
      activeRunId: null,
      lastPlayedRunId: null,
      updatedAt: null
    };
  }

  function normalizeManifest(candidate) {
    const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
    const uniqueIds = (values) => [...new Set((Array.isArray(values) ? values : []).map(cleanId).filter(Boolean))];
    return {
      version: LIBRARY_VERSION,
      worldIds: uniqueIds(source.worldIds),
      runIds: uniqueIds(source.runIds),
      activeRunId: cleanId(source.activeRunId) || null,
      lastPlayedRunId: cleanId(source.lastPlayedRunId) || null,
      updatedAt: source.updatedAt ? String(source.updatedAt) : null
    };
  }

  const COMPRESSED_STORAGE_PREFIX = "lz16:";
  const LZW_CLEAR_CODE = 256;
  const LZW_FIRST_SEQUENCE_CODE = 257;
  const LZW_MAX_CODE = 65535;

  function compressStorageText(text) {
    const input = new TextEncoder().encode(String(text || ""));
    if (!input.length) return COMPRESSED_STORAGE_PREFIX;
    const dictionary = new Map();
    const output = [];
    let nextCode = LZW_FIRST_SEQUENCE_CODE;
    let phrase = String.fromCharCode(input[0]);
    const phraseCode = (value) => value.length === 1 ? value.charCodeAt(0) : dictionary.get(value);
    for (let index = 1; index < input.length; index += 1) {
      const character = String.fromCharCode(input[index]);
      const combined = phrase + character;
      if (dictionary.has(combined)) {
        phrase = combined;
        continue;
      }
      output.push(phraseCode(phrase));
      if (nextCode <= LZW_MAX_CODE) {
        dictionary.set(combined, nextCode);
        nextCode += 1;
      } else {
        output.push(LZW_CLEAR_CODE);
        dictionary.clear();
        nextCode = LZW_FIRST_SEQUENCE_CODE;
      }
      phrase = character;
    }
    output.push(phraseCode(phrase));
    let packed = COMPRESSED_STORAGE_PREFIX;
    const chunkSize = 8192;
    for (let index = 0; index < output.length; index += chunkSize) packed += String.fromCharCode(...output.slice(index, index + chunkSize));
    return packed;
  }

  function decompressStorageText(value) {
    const packed = String(value || "");
    if (!packed.startsWith(COMPRESSED_STORAGE_PREFIX)) return packed;
    const codes = packed.slice(COMPRESSED_STORAGE_PREFIX.length);
    if (!codes.length) return "";
    let dictionary = new Map();
    let nextCode = LZW_FIRST_SEQUENCE_CODE;
    let phrase = "";
    const byteChunks = [];
    let byteCount = 0;
    for (let index = 0; index < codes.length; index += 1) {
      const code = codes.charCodeAt(index);
      if (code === LZW_CLEAR_CODE) {
        dictionary = new Map();
        nextCode = LZW_FIRST_SEQUENCE_CODE;
        phrase = "";
        continue;
      }
      const entry = code < LZW_CLEAR_CODE
        ? String.fromCharCode(code)
        : (dictionary.get(code) || (code === nextCode && phrase ? phrase + phrase[0] : null));
      if (entry === null) throw new Error("A compressed library record is corrupt.");
      if (phrase) {
        if (nextCode <= LZW_MAX_CODE) {
          dictionary.set(nextCode, phrase + entry[0]);
          nextCode += 1;
        }
      }
      byteChunks.push(entry);
      byteCount += entry.length;
      phrase = entry;
    }
    const bytes = new Uint8Array(byteCount);
    let cursor = 0;
    for (const chunk of byteChunks) for (let index = 0; index < chunk.length; index += 1) bytes[cursor++] = chunk.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  }

  function createRepository(storage) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new Error("A Web Storage-compatible adapter is required.");
    }

    function readJson(key) {
      const raw = storage.getItem(key);
      if (!raw) return null;
      return JSON.parse(decompressStorageText(raw));
    }

    function manifest() {
      return normalizeManifest(readJson(MANIFEST_KEY));
    }

    function writeManifest(next) {
      const normalized = normalizeManifest(next);
      normalized.updatedAt = new Date().toISOString();
      storage.setItem(MANIFEST_KEY, JSON.stringify(normalized));
      return normalized;
    }

    function getWorld(id) {
      const worldId = cleanId(id);
      if (!worldId) return null;
      const value = readJson(`${WORLD_KEY_PREFIX}${worldId}`);
      return value ? normalizeWorld(value) : null;
    }

    function getRun(id) {
      const runId = cleanId(id);
      if (!runId) return null;
      const value = readJson(`${RUN_KEY_PREFIX}${runId}`);
      return value ? normalizeRunStorageRecord(runId, value) : null;
    }

    function listWorlds() {
      return manifest().worldIds.map(getWorld).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    function listRuns(worldId = null) {
      const requestedWorldId = cleanId(worldId);
      return manifest().runIds.map(getRun).filter((run) => run && (!requestedWorldId || run.worldId === requestedWorldId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    function putWorld(candidate) {
      const world = normalizeWorld(candidate);
      const current = getWorld(world.id);
      if (current && current.canonicalDigest !== world.canonicalDigest) {
        throw new Error("A different canonical world already uses this ID.");
      }
      const next = manifest();
      if (!next.worldIds.includes(world.id)) next.worldIds.push(world.id);
      storage.setItem(`${WORLD_KEY_PREFIX}${world.id}`, compressStorageText(JSON.stringify(world)));
      writeManifest(next);
      return clone(world);
    }

    function putRun(candidate, options = {}) {
      const run = normalizeRun(candidate);
      const world = getWorld(run.worldId);
      if (!world) throw new Error("The run references a world that is not in this library.");
      if (run.canonicalWorldDigest !== world.canonicalDigest || run.worldGenerationVersion !== world.generationVersion) {
        throw new Error("The run does not reference the saved canonical world record.");
      }
      if (run.worldState?.canonicalWorldDigest !== world.canonicalDigest) {
        throw new Error("The run's mutable branch does not reference the saved canonical world.");
      }
      if (run.state && Object.hasOwn(run.state, "runEnded") && Boolean(run.state.runEnded) !== (run.status === "ended")) {
        throw new Error("The run lifecycle does not match its saved simulation state.");
      }
      if (run.state?.runIdentity?.runId && cleanId(run.state.runIdentity.runId) !== run.id) {
        throw new Error("The simulation state does not match its run ID.");
      }
      if (run.state?.worldReference?.worldId && cleanId(run.state.worldReference.worldId) !== world.id) {
        throw new Error("The simulation state does not match its world ID.");
      }
      if (!options.overwrite && getRun(run.id)) throw new Error("A run already uses this ID.");
      const next = manifest();
      if (!next.runIds.includes(run.id)) next.runIds.push(run.id);
      if (options.activate !== false) {
        next.activeRunId = run.id;
        next.lastPlayedRunId = run.id;
      } else if (next.activeRunId === run.id && run.status !== "active") {
        next.activeRunId = null;
      }
      storage.setItem(`${RUN_KEY_PREFIX}${run.id}`, compressStorageText(JSON.stringify(run)));
      writeManifest(next);
      return clone(run);
    }

    function setActiveRun(id) {
      const run = getRun(id);
      if (!run || run.status !== "active") throw new Error("Only an active saved run can be continued.");
      const next = manifest();
      next.activeRunId = run.id;
      next.lastPlayedRunId = run.id;
      writeManifest(next);
      return clone(run);
    }

    function continuation() {
      const current = manifest();
      const preferred = [current.activeRunId, current.lastPlayedRunId].map(getRun).find((run) => run?.status === "active");
      return preferred || listRuns().find((run) => run.status === "active") || null;
    }

    function deleteRun(id) {
      const runId = cleanId(id);
      const current = manifest();
      if (!current.runIds.includes(runId)) return false;
      storage.removeItem(`${RUN_KEY_PREFIX}${runId}`);
      current.runIds = current.runIds.filter((entry) => entry !== runId);
      if (current.activeRunId === runId) current.activeRunId = null;
      if (current.lastPlayedRunId === runId) current.lastPlayedRunId = null;
      writeManifest(current);
      return true;
    }

    function deleteWorld(id) {
      const worldId = cleanId(id);
      if (listRuns(worldId).length) throw new Error("Delete this world's runs before deleting the world.");
      const current = manifest();
      if (!current.worldIds.includes(worldId)) return false;
      storage.removeItem(`${WORLD_KEY_PREFIX}${worldId}`);
      current.worldIds = current.worldIds.filter((entry) => entry !== worldId);
      writeManifest(current);
      return true;
    }

    function snapshot() {
      const current = manifest();
      return {
        manifest: current,
        worlds: listWorlds(),
        runs: listRuns()
      };
    }

    return Object.freeze({
      manifest,
      getWorld,
      getRun,
      listWorlds,
      listRuns,
      putWorld,
      putRun,
      setActiveRun,
      continuation,
      deleteRun,
      deleteWorld,
      snapshot
    });
  }

  return Object.freeze({
    LIBRARY_VERSION,
    WORLD_RECORD_VERSION,
    RUN_RECORD_VERSION,
    WORLD_GENERATION_VERSION,
    WORLD_NAME_VERSION,
    THEME_CONTENT_VERSION: ThemeContent.VERSION,
    STRATEGIC_MAP_VERSION: StrategicWorld.STRATEGIC_MAP_VERSION,
    RELIEF_VERSION: PlanetaryRelief.RELIEF_VERSION,
    CLIMATE_VERSION: ClimateHydrologyBiomes.CLIMATE_VERSION,
    HYDROLOGY_VERSION: ClimateHydrologyBiomes.HYDROLOGY_VERSION,
    BIOME_VERSION: ClimateHydrologyBiomes.BIOME_VERSION,
    GEOLOGY_VERSION: StrategicGeology.GEOLOGY_VERSION,
    NATURAL_HAZARD_VERSION: StrategicGeology.NATURAL_HAZARD_VERSION,
    ARCANE_GEOGRAPHY_VERSION: StrategicArcaneGeography.ARCANE_GEOGRAPHY_VERSION,
    MAGICAL_HAZARD_VERSION: StrategicArcaneGeography.MAGICAL_HAZARD_VERSION,
    RESOURCE_POTENTIAL_VERSION: StrategicResourcePotential.RESOURCE_POTENTIAL_VERSION,
    PUBLIC_PROSPECT_VERSION: StrategicResourcePotential.PUBLIC_PROSPECT_VERSION,
    HUMAN_GEOGRAPHY_VERSION: StrategicHumanGeography.HUMAN_GEOGRAPHY_VERSION,
    CITY_POLITIES_VERSION: StrategicCityPolities.CITY_POLITIES_VERSION,
    MANIFEST_KEY,
    WORLD_KEY_PREFIX,
    RUN_KEY_PREFIX,
    THEMES,
    cleanSeed,
    cleanId,
    stableHash,
    generatedWorldName,
    generatedPlayableYear,
    canonicalWorldDigest,
    compressStorageText,
    decompressStorageText,
    createWorld,
    normalizeWorld,
    createRun,
    normalizeRun,
    normalizeRunStorageRecord,
    emptyManifest,
    normalizeManifest,
    createRepository,
    clone
  });
});
