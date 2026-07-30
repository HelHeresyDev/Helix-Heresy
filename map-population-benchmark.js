(function attachHelixMapPopulationBenchmark(root, factory) {
  const mapVisualState = typeof module === "object" && module.exports
    ? require("./map-visual-state.js")
    : root?.HelixMapVisualState;
  const canvasRenderer = typeof module === "object" && module.exports
    ? require("./canvas-map-renderer.js")
    : root?.HelixCanvasMapRenderer;
  const api = factory(mapVisualState, canvasRenderer);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixMapPopulationBenchmark = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createMapPopulationBenchmark(MapVisualState, CanvasRenderer) {
  "use strict";

  if (!MapVisualState || !CanvasRenderer) {
    throw new Error("Map population benchmarks require MapVisualState and the Canvas renderer.");
  }

  const MAP_SIZE = Object.freeze({ width: 256, height: 192, tileSizeM: 1, layerHeightM: 3 });
  const VIEWPORT = Object.freeze({ x: 48, y: 48, z: 0, width: 96, height: 54 });
  const SCENARIOS = Object.freeze({
    representative: Object.freeze({
      entityCount: 500,
      visibleEntities: 120,
      effectCount: 150,
      visibleEffects: 40,
      sceneBudgetMs: 12,
      drawBudgetMs: 8
    }),
    dense: Object.freeze({
      entityCount: 1000,
      visibleEntities: 500,
      effectCount: 600,
      visibleEffects: 300,
      sceneBudgetMs: 25,
      drawBudgetMs: 16.7
    }),
    offscreen: Object.freeze({
      entityCount: 5000,
      visibleEntities: 120,
      effectCount: 1800,
      visibleEffects: 40,
      sceneBudgetMs: 12,
      drawBudgetMs: 8
    })
  });

  function percentile(samples, value = 0.95) {
    const ordered = [...samples].sort((left, right) => left - right);
    if (!ordered.length) return 0;
    return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * value) - 1)];
  }

  function rounded(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
  }

  function entitySeed(index, visible) {
    const width = index % 11 === 0 ? 2 : 1;
    const height = index % 17 === 0 ? 2 : 1;
    const depth = index % 29 === 0 ? 2 : 1;
    const x = visible
      ? VIEWPORT.x + 2 + (index * 7) % (VIEWPORT.width - width - 4)
      : 166 + (index * 13) % 82;
    const y = visible
      ? VIEWPORT.y + 2 + (index * 11) % (VIEWPORT.height - height - 4)
      : 4 + (index * 17) % 180;
    const footprintCells = [];
    for (let z = 0; z < depth; z += 1) {
      for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          footprintCells.push({ x: x + dx, y: y + dy, z });
        }
      }
    }
    return {
      id: `benchmark-actor-${index}`,
      kind: "slime",
      category: "actor",
      anchorCell: { x, y, z: 0 },
      footprintCells,
      bounds: { x, y, z: 0, width, height, depth },
      target: { kind: "slime", id: `benchmark-actor-${index}` },
      facing: ["north", "east", "south", "west"][index % 4],
      pose: index % 9 === 0 ? "working" : "idle",
      knowledge: { state: "current", confidence: 1 },
      visual: { key: "actor.slime.unknown", glyph: "L", layer: "actor" },
      condition: { band: index % 23 === 0 ? "strained" : "stable", cues: [] }
    };
  }

  function effectSeed(index, visible) {
    const x = visible
      ? VIEWPORT.x + 1 + (index * 19) % (VIEWPORT.width - 2)
      : 166 + (index * 23) % 84;
    const y = visible
      ? VIEWPORT.y + 1 + (index * 29) % (VIEWPORT.height - 2)
      : 2 + (index * 31) % 186;
    const planes = ["ground", "world", "alert"];
    return {
      id: `benchmark-effect-${index}`,
      kind: index % 3 === 0 ? "spill" : index % 3 === 1 ? "structural" : "incident",
      plane: planes[index % planes.length],
      cells: [{ x, y, z: 0 }],
      knowledge: { state: "current", confidence: 1 },
      severity: index % 13 === 0 ? "serious" : "advisory",
      intensityBand: index % 7 === 0 ? "high" : "medium",
      visualKey: "effect.unknown",
      glyph: index % 3 === 0 ? "~" : "!",
      label: `Benchmark effect ${index}`
    };
  }

  function buildWorld(definition) {
    const entities = Array.from({ length: definition.entityCount }, (_, index) =>
      entitySeed(index, index < definition.visibleEntities));
    const effects = Array.from({ length: definition.effectCount }, (_, index) =>
      effectSeed(index, index < definition.visibleEffects));
    return {
      entities,
      effects,
      entityQuery: MapVisualState.createSpatialQuery(entities),
      effectQuery: MapVisualState.createSpatialQuery(effects)
    };
  }

  function cellsForBounds(bounds) {
    const cells = [];
    for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
        cells.push({
          key: `${x},${y},${bounds.z}`,
          cell: { x, y, z: bounds.z },
          base: { kind: "room", role: "mainLab" },
          knowledge: { state: "current", confidence: 1 },
          visual: { glyph: "", spriteKey: "", layer: "terrain" },
          interaction: { primaryTarget: null, targets: [] }
        });
      }
    }
    return cells;
  }

  function buildBenchmarkScene(world, viewport = VIEWPORT) {
    const queryBounds = MapVisualState.overscanBounds(viewport, MAP_SIZE, 1);
    return MapVisualState.buildScene({
      viewport,
      queryBounds,
      mapSize: MAP_SIZE,
      perspective: { kind: "debug" },
      cells: cellsForBounds(queryBounds),
      entities: world.entities,
      effects: world.effects,
      overlays: [],
      spatialQueries: {
        entities: world.entityQuery,
        effects: world.effectQuery
      }
    });
  }

  function timeSamples(iterations, callback) {
    const samples = [];
    let result = null;
    for (let index = 0; index < iterations; index += 1) {
      const startedAt = performance.now();
      result = callback(index);
      samples.push(performance.now() - startedAt);
    }
    return { samples, result };
  }

  async function measureIdleFrames(canvas, scene) {
    const renderer = CanvasRenderer.createRenderer(canvas, {
      devicePixelRatio: 1,
      now: () => performance.now()
    });
    renderer.setScene(scene, { tilePx: 8, glyphMode: true, includeOverscan: true });
    await new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const before = renderer.snapshot().frameCount;
    await new Promise((resolve) => setTimeout(resolve, 75));
    const after = renderer.snapshot().frameCount;
    const diagnostics = renderer.snapshot();
    renderer.destroy();
    return { before, after, stable: before === after, diagnostics };
  }

  async function run(canvas, options = {}) {
    const mode = options.mode === "full" ? "full" : "quick";
    const drawIterations = mode === "full" ? 120 : 30;
    const sceneIterations = mode === "full" ? 30 : 8;
    const results = {};
    for (const [name, definition] of Object.entries(SCENARIOS)) {
      const worldStartedAt = performance.now();
      const world = buildWorld(definition);
      const worldMs = performance.now() - worldStartedAt;
      const queryBounds = MapVisualState.overscanBounds(VIEWPORT, MAP_SIZE, 1);
      const queryTimes = timeSamples(sceneIterations, () => ({
        entities: world.entityQuery.query(queryBounds),
        effects: world.effectQuery.query(queryBounds)
      }));
      const sceneTimes = timeSamples(sceneIterations, () => buildBenchmarkScene(world));
      const scene = sceneTimes.result;
      const planTimes = timeSamples(sceneIterations, () =>
        CanvasRenderer.prepareDrawPlan(scene, { includeOverscan: true }));
      const drawPlan = planTimes.result;
      const ctx = canvas.getContext("2d", { alpha: false });
      canvas.width = VIEWPORT.width * 8 + 16;
      canvas.height = VIEWPORT.height * 8 + 16;
      for (let warmup = 0; warmup < 5; warmup += 1) {
        CanvasRenderer.renderScene(ctx, scene, {
          tilePx: 8,
          glyphMode: true,
          includeOverscan: true,
          drawPlan
        });
      }
      const drawTimes = timeSamples(drawIterations, () => CanvasRenderer.renderScene(ctx, scene, {
        tilePx: 8,
        glyphMode: true,
        includeOverscan: true,
        drawPlan
      }));
      const counts = drawTimes.result;
      const sceneP95 = percentile(sceneTimes.samples);
      const drawP95 = percentile(drawTimes.samples);
      results[name] = {
        population: {
          entities: definition.entityCount,
          effects: definition.effectCount,
          visibleEntities: scene.entities.length,
          visibleEffects: scene.effects.length,
          cells: scene.cells.length
        },
        stagesMs: {
          world: rounded(worldMs),
          queryP95: rounded(percentile(queryTimes.samples)),
          sceneP95: rounded(sceneP95),
          drawPlanP95: rounded(percentile(planTimes.samples)),
          drawP95: rounded(drawP95)
        },
        budgets: {
          sceneMs: definition.sceneBudgetMs,
          drawMs: definition.drawBudgetMs,
          scenePass: sceneP95 <= definition.sceneBudgetMs,
          drawPass: drawP95 <= definition.drawBudgetMs,
          advisory: true
        },
        culling: scene.culling,
        drawPlan: counts.drawPlanStats
      };
    }

    const representative = results.representative.population;
    const offscreen = results.offscreen.population;
    const offscreenInvariant = representative.visibleEntities === offscreen.visibleEntities
      && representative.visibleEffects === offscreen.visibleEffects
      && results.representative.drawPlan.visibleEntities === results.offscreen.drawPlan.visibleEntities
      && results.representative.drawPlan.visibleEffects === results.offscreen.drawPlan.visibleEffects;

    const navigationWorld = buildWorld(SCENARIOS.representative);
    const navigationTimes = timeSamples(mode === "full" ? 40 : 10, (index) => {
      const viewport = { ...VIEWPORT, x: VIEWPORT.x + (index % 8), y: VIEWPORT.y + (index % 5) };
      const scene = buildBenchmarkScene(navigationWorld, viewport);
      return CanvasRenderer.prepareDrawPlan(scene, { includeOverscan: true });
    });
    const idleScene = buildBenchmarkScene(navigationWorld);
    const idle = await measureIdleFrames(canvas, idleScene);
    const updateTimes = timeSamples(mode === "full" ? 40 : 10, (index) => {
      const prior = navigationWorld.entities[0];
      const x = VIEWPORT.x + 2 + (index % 6);
      const updated = {
        ...prior,
        anchorCell: { ...prior.anchorCell, x },
        footprintCells: prior.footprintCells.map((cell) => ({ ...cell, x })),
        bounds: { ...prior.bounds, x }
      };
      const entities = [updated, ...navigationWorld.entities.slice(1)];
      const updatedWorld = {
        entities,
        effects: navigationWorld.effects,
        entityQuery: MapVisualState.createSpatialQuery(entities),
        effectQuery: navigationWorld.effectQuery
      };
      const scene = buildBenchmarkScene(updatedWorld);
      return CanvasRenderer.prepareDrawPlan(scene, { includeOverscan: true });
    });
    return {
      version: 1,
      mode,
      rendererVersion: CanvasRenderer.RENDERER_VERSION,
      generatedAt: new Date().toISOString(),
      iterations: { scene: sceneIterations, draw: drawIterations },
      scenarios: results,
      navigation: {
        sceneAndPlanP95Ms: rounded(percentile(navigationTimes.samples)),
        samples: navigationTimes.samples.length
      },
      update: {
        indexSceneAndPlanP95Ms: rounded(percentile(updateTimes.samples)),
        samples: updateTimes.samples.length
      },
      invariants: {
        offscreenScalePreservesVisibleCounts: offscreenInvariant,
        idleSchedulesNoFrames: idle.stable,
        idleFrameCount: idle.after,
        cachedDrawPlanBuilds: idle.diagnostics.drawPlanBuilds,
        cachedDrawPlanUses: idle.diagnostics.drawPlanUses
      },
      valid: offscreenInvariant && idle.stable
    };
  }

  return {
    MAP_SIZE,
    VIEWPORT,
    SCENARIOS,
    percentile,
    buildWorld,
    buildBenchmarkScene,
    run
  };
}));
