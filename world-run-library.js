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
  const api = factory(themeContent, strategicWorld, planetaryRelief, climateHydrologyBiomes, strategicGeology, strategicArcaneGeography);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixWorldRunLibrary = api;
})(typeof window !== "undefined" ? window : globalThis, function createWorldRunLibraryApi(ThemeContent, StrategicWorld, PlanetaryRelief, ClimateHydrologyBiomes, StrategicGeology, StrategicArcaneGeography) {
  "use strict";

  if (!ThemeContent) throw new Error("HelixThemeContent must load before world-run-library.js");
  if (!StrategicWorld) throw new Error("HelixStrategicWorld must load before world-run-library.js");
  if (!PlanetaryRelief) throw new Error("HelixPlanetaryRelief must load before world-run-library.js");
  if (!ClimateHydrologyBiomes) throw new Error("HelixClimateHydrologyBiomes must load before world-run-library.js");
  if (!StrategicGeology) throw new Error("HelixStrategicGeology must load before world-run-library.js");
  if (!StrategicArcaneGeography) throw new Error("HelixStrategicArcaneGeography must load before world-run-library.js");

  const LIBRARY_VERSION = 2;
  const WORLD_RECORD_VERSION = 1;
  const RUN_RECORD_VERSION = 1;
  const WORLD_GENERATION_VERSION = 6;
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
      generatedData = generationVersion >= 2 ? {
        version: generationVersion,
        strategicResolution: generationVersion >= 6
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

  function createRepository(storage) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new Error("A Web Storage-compatible adapter is required.");
    }

    function readJson(key) {
      const raw = storage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
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
      storage.setItem(`${WORLD_KEY_PREFIX}${world.id}`, JSON.stringify(world));
      writeManifest(next);
      return clone(world);
    }

    function putRun(candidate, options = {}) {
      const run = normalizeRun(candidate);
      const world = getWorld(run.worldId);
      if (!world) throw new Error("The run references a world that is not in this library.");
      if (run.canonicalWorldDigest !== world.canonicalDigest || run.worldGenerationVersion !== world.generationVersion) {
        throw new Error("The run does not reference the saved canonical world version.");
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
      storage.setItem(`${RUN_KEY_PREFIX}${run.id}`, JSON.stringify(run));
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
