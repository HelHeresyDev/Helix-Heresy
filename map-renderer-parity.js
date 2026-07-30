(function attachHelixMapRendererParity(root, factory) {
  const visualState = typeof module === "object" && module.exports
    ? require("./map-visual-state.js")
    : root?.HelixMapVisualState;
  const renderOrder = typeof module === "object" && module.exports
    ? require("./map-render-order.js")
    : root?.HelixMapRenderOrder;
  const canvasRenderer = typeof module === "object" && module.exports
    ? require("./canvas-map-renderer.js")
    : root?.HelixCanvasMapRenderer;
  const api = factory(visualState, renderOrder, canvasRenderer);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HelixMapRendererParity = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createMapRendererParity(
  MapVisualState,
  RenderOrder,
  CanvasRenderer
) {
  "use strict";

  if (!MapVisualState || !RenderOrder || !CanvasRenderer) {
    throw new Error("Renderer parity fixtures require map visual state, render order, and Canvas rendering.");
  }

  const FIXTURE_IDS = Object.freeze([
    "terrain",
    "knowledge",
    "effects",
    "crowded",
    "vertical",
    "accessibility"
  ]);
  const FIXTURE_VERSION = 1;
  const WIDTH = 8;
  const HEIGHT = 6;

  function cellKey(cell) {
    return MapVisualState.cellKey(cell);
  }

  function targetKey(target) {
    return RenderOrder.targetKey(target);
  }

  function baseCells(z = 0) {
    const cells = [];
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const boundary = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
        const cell = { x, y, z };
        cells.push({
          key: cellKey(cell),
          cell,
          known: true,
          knowledge: { state: "current", confidence: 1, tier: "current" },
          roomId: boundary ? "" : "mainLab",
          base: boundary
            ? { kind: "solidEarth", state: "intact", spriteKey: "tile.solidEarth" }
            : { kind: "room", role: "mainLab", roomId: "mainLab", spriteKey: "" },
          lighting: { band: boundary ? "dark" : "lit", intensity: boundary ? 0.05 : 0.7, spectrum: "warm" },
          atmosphere: null,
          door: null,
          object: null,
          incident: null,
          route: null,
          overlay: null,
          anchor: false,
          scientist: false,
          selected: false,
          cursor: false,
          visual: {
            glyph: boundary ? "#" : ".",
            spriteKey: boundary ? "tile.solidEarth" : "",
            layer: "terrain"
          },
          tooltip: { parts: [`Fixture cell ${x},${y},${z}`], text: `Fixture cell ${x},${y},${z}` },
          target: boundary ? null : { kind: "tile", tile: cell },
          interactionTargets: boundary ? [] : [{ kind: "tile", tile: cell }]
        });
      }
    }
    return cells;
  }

  function cellAt(cells, x, y, z = cells[0]?.cell?.z || 0) {
    return cells.find((entry) => cellKey(entry.cell) === cellKey({ x, y, z }));
  }

  function changeCell(cells, x, y, changes, z = cells[0]?.cell?.z || 0) {
    const cell = cellAt(cells, x, y, z);
    if (!cell) throw new Error(`Missing parity fixture cell ${x},${y},${z}.`);
    Object.assign(cell, changes);
    return cell;
  }

  function actor(id, cells, options = {}) {
    const anchorCell = cells[0];
    return {
      id,
      kind: "slime",
      category: "actor",
      anchorCell,
      footprintCells: cells,
      target: { kind: "slime", id },
      facing: options.facing || "east",
      pose: options.pose || "idle",
      activity: { family: options.activity || "idle" },
      condition: { band: options.condition || "stable", cues: options.cues || [] },
      statusCues: options.statusCues || [],
      knowledge: options.knowledge || { state: "current", confidence: 1 },
      visual: {
        key: options.spriteKey || (cells.length > 1 ? "actor.slime.large" : "actor.slime"),
        glyph: options.glyph || "L",
        layer: "actor"
      }
    };
  }

  function fixture(id, anchorCell, footprintCells, options = {}) {
    return {
      id,
      kind: "fixture",
      category: "fixture",
      anchorCell,
      footprintCells,
      target: { kind: "fixture", id },
      orientation: options.orientation || { quarterTurns: 0, mirrored: false },
      knowledge: options.knowledge || { state: "current", confidence: 1 },
      statusCues: options.statusCues || [],
      visual: {
        key: options.spriteKey || "fixture.basicWorkbench",
        glyph: options.glyph || "W",
        layer: options.layer || "fixture"
      }
    };
  }

  function effect(id, cell, options = {}) {
    return {
      id,
      kind: options.kind || "effect",
      sourceId: id,
      cells: options.cells || [cell],
      plane: options.plane || "world",
      knowledge: options.knowledge || { state: "current", confidence: 1 },
      severity: options.severity || "advisory",
      state: options.state || "active",
      intensityBand: options.intensityBand || "medium",
      uncertaintyRadius: options.uncertaintyRadius || 0,
      stackCount: options.stackCount || 1,
      damageTags: options.damageTags || [],
      glyph: options.glyph || "*",
      visualKey: options.visualKey || "effect.hazard.pulse",
      label: options.label || id,
      target: options.target || null,
      relatedTargets: options.relatedTargets || []
    };
  }

  function terrainFixture() {
    const cells = baseCells();
    changeCell(cells, 3, 0, {
      base: { kind: "constructedWall", materialId: "stone", state: "damaged", spriteKey: "" },
      visual: { glyph: "W", spriteKey: "", layer: "terrain" },
      knowledge: { state: "current", confidence: 1 }
    });
    changeCell(cells, 3, 1, {
      base: { kind: "floor", smoothed: true, constructedFloor: "stone", roomId: "mainLab" },
      door: { key: "parity-door", state: "closed" },
      visual: { glyph: "x", spriteKey: "door.closed", layer: "door" },
      target: { kind: "door", key: "parity-door" },
      interactionTargets: [{ kind: "door", key: "parity-door" }]
    });
    changeCell(cells, 2, 2, {
      anchor: true,
      selected: true,
      visual: { glyph: "M", spriteKey: "", layer: "room" },
      target: { kind: "room", roomId: "mainLab" },
      interactionTargets: [{ kind: "room", roomId: "mainLab" }]
    });
    changeCell(cells, 3, 2, {
      route: { taskId: "route-1", selected: true },
      visual: { glyph: "·", spriteKey: "", layer: "path" }
    });
    changeCell(cells, 4, 2, { cursor: true });
    return {
      title: "Terrain, doors, route, selection",
      cells,
      entities: [],
      effects: [],
      overlays: [],
      selection: { target: { kind: "room", roomId: "mainLab" }, cells: [{ x: 2, y: 2, z: 0 }] },
      presentation: { tilePx: 18, glyphMode: true }
    };
  }

  function knowledgeFixture() {
    const cells = baseCells();
    const states = [
      ["current", "dark", ""],
      ["current", "dim", ""],
      ["current", "lit", ""],
      ["current", "bright", ""],
      ["stale", "remembered", "aged"],
      ["stale", "remembered", "archived"]
    ];
    states.forEach(([state, band, tier], index) => {
      changeCell(cells, index + 1, 2, {
        knowledge: { state, confidence: state === "stale" ? 0.55 : 1, tier },
        lighting: { band, intensity: index / 5, spectrum: index > 2 ? "warm" : "neutral" },
        atmosphere: index === 3 ? { visible: true, band: "dense", kind: "airborne" } : null,
        visual: { glyph: String(index + 1), spriteKey: "", layer: "terrain" }
      });
    });
    changeCell(cells, 6, 3, {
      known: false,
      knowledge: { state: "unknown", confidence: 0 },
      base: { kind: "unknownDark" },
      lighting: { band: "unknown", intensity: 0, spectrum: "neutral" },
      visual: { glyph: "", spriteKey: "", layer: "terrain" },
      target: null,
      interactionTargets: []
    });
    return {
      title: "Knowledge, lighting, atmosphere",
      cells,
      entities: [],
      effects: [],
      overlays: [],
      selection: {},
      presentation: { tilePx: 24, glyphMode: true }
    };
  }

  function effectsFixture() {
    const cells = baseCells();
    const effects = [
      effect("ground-spill", { x: 2, y: 2, z: 0 }, {
        kind: "hazardousSpill", plane: "ground", glyph: "~", damageTags: ["toxic"], severity: "serious"
      }),
      effect("world-failure", { x: 3, y: 2, z: 0 }, {
        kind: "structuralFailure", plane: "world", glyph: "*", intensityBand: "high"
      }),
      effect("alert-incident", { x: 4, y: 2, z: 0 }, {
        kind: "incident", plane: "alert", glyph: "!", stackCount: 3, severity: "critical",
        target: { kind: "incident", id: "alert-incident" }
      }),
      effect("uncertain-alert", { x: 5, y: 2, z: 0 }, {
        kind: "incident", plane: "alert", glyph: "?", uncertaintyRadius: 1,
        knowledge: { state: "uncertain", confidence: 0.4 },
        target: { kind: "incident", id: "uncertain-alert" }
      })
    ];
    const overlayCells = [
      [2, 3, "contamination", ["contamination-hazardous"], "Hazardous"],
      [3, 3, "temperature", ["temperature-hot"], "Hot"],
      [4, 3, "access", ["access-forbidden"], "Forbidden"],
      [5, 3, "construction", ["construction-planned"], "Planned"]
    ];
    const overlays = overlayCells.map(([x, y, id, states, label], index) => {
      const targetCell = { x, y, z: 0 };
      changeCell(cells, x, y, {
        overlay: { id, states, label, value: index + 1, target: { kind: "tile", tile: targetCell } },
        visual: { glyph: ["!", "H", "×", "W"][index], spriteKey: "", layer: "overlay" }
      });
      return { id: `overlay-${id}`, kind: id, cells: [targetCell], label, visualKey: `overlay.${id}` };
    });
    return {
      title: "Effect planes and overlays",
      cells,
      entities: [],
      effects,
      overlays,
      selection: {},
      presentation: { tilePx: 26, glyphMode: true, effectIntensity: "strong" }
    };
  }

  function crowdedFixture() {
    const cells = baseCells();
    const occupied = { x: 3, y: 2, z: 0 };
    const targets = [
      { kind: "incident", id: "crowded-alert" },
      { kind: "slime", id: "crowded-slime" },
      { kind: "container", id: "crowded-container" },
      { kind: "itemStack", id: "crowded-item" },
      { kind: "tile", tile: occupied }
    ];
    changeCell(cells, 3, 2, {
      object: { tags: ["container", "blocking", "living"], targets },
      selected: true,
      cursor: true,
      visual: { glyph: "L", spriteKey: "actor.slime", layer: "actor" },
      target: targets[0],
      interactionTargets: targets,
      tooltip: { parts: ["Crowded tile", "Five ordered targets"], text: "Crowded tile\nFive ordered targets" }
    });
    const entities = [
      {
        id: "crowded-item",
        kind: "itemStack",
        category: "itemStack",
        anchorCell: occupied,
        footprintCells: [occupied],
        target: { kind: "itemStack", id: "crowded-item" },
        knowledge: { state: "current" },
        visual: { key: "item.stack", glyph: "i", layer: "item" }
      },
      {
        id: "crowded-container",
        kind: "container",
        category: "container",
        anchorCell: occupied,
        footprintCells: [occupied],
        target: { kind: "container", id: "crowded-container" },
        knowledge: { state: "current" },
        statusCues: [{ id: "damaged", severity: "warning", label: "Damaged", glyph: "!" }],
        visual: { key: "object.unknown", glyph: "C", layer: "fixture" }
      },
      actor("crowded-slime", [occupied], {
        pose: "attacking",
        condition: "critical",
        cues: ["critical"],
        statusCues: [{ id: "urgent", severity: "critical", label: "Urgent", glyph: "!!" }]
      })
    ];
    const effects = [effect("crowded-alert", occupied, {
      kind: "incident",
      plane: "alert",
      glyph: "!",
      severity: "critical",
      target: { kind: "incident", id: "crowded-alert" }
    })];
    return {
      title: "Crowded tile and target order",
      cells,
      entities,
      effects,
      overlays: [],
      selection: { target: { kind: "slime", id: "crowded-slime" }, cells: [occupied] },
      presentation: { tilePx: 28, glyphMode: true }
    };
  }

  function verticalFixture() {
    const cells = baseCells(1);
    const body = [
      { x: 2, y: 2, z: 0 }, { x: 3, y: 2, z: 0 },
      { x: 2, y: 2, z: 1 }, { x: 3, y: 2, z: 1 }
    ];
    const overheadCells = [{ x: 2, y: 2, z: 1 }, { x: 3, y: 2, z: 1 }];
    for (const point of overheadCells) {
      changeCell(cells, point.x, point.y, {
        object: { tags: ["living", "fixture"], targets: [{ kind: "slime", id: "tall-slime" }, { kind: "fixture", id: "overhead-duct" }] },
        visual: { glyph: "L", spriteKey: "actor.slime.large", layer: "actor" },
        selected: true,
        target: { kind: "fixture", id: "overhead-duct" },
        interactionTargets: [{ kind: "fixture", id: "overhead-duct" }, { kind: "slime", id: "tall-slime" }]
      }, 1);
    }
    changeCell(cells, 4, 3, {
      base: { kind: "floor", verticalDirection: "both", roomId: "mainLab" },
      visual: { glyph: "↕", spriteKey: "", layer: "terrain" }
    }, 1);
    return {
      title: "Z layer, tall body, overhead cutaway",
      cells,
      entities: [
        actor("tall-slime", body, { spriteKey: "actor.slime.large", condition: "strained" }),
        fixture("overhead-duct", overheadCells[0], overheadCells, { layer: "overhead", glyph: "=" })
      ],
      effects: [effect("vertical-alert", { x: 3, y: 3, z: 1 }, {
        kind: "incident", plane: "alert", glyph: "!", target: { kind: "incident", id: "vertical-alert" }
      })],
      overlays: [],
      selection: { target: { kind: "slime", id: "tall-slime" }, cells: overheadCells },
      presentation: { tilePx: 34, glyphMode: true }
    };
  }

  function accessibilityFixture() {
    const cells = baseCells();
    const largeCells = [
      { x: 2, y: 2, z: 0 }, { x: 3, y: 2, z: 0 },
      { x: 2, y: 3, z: 0 }, { x: 3, y: 3, z: 0 }
    ];
    for (const point of largeCells) {
      changeCell(cells, point.x, point.y, {
        object: { tags: ["living"], targets: [{ kind: "slime", id: "sprite-slime" }] },
        visual: { glyph: "L", spriteKey: "actor.slime.large", layer: "actor" },
        selected: true,
        target: { kind: "slime", id: "sprite-slime" },
        interactionTargets: [{ kind: "slime", id: "sprite-slime" }]
      });
    }
    changeCell(cells, 5, 2, {
      object: { tags: ["fixture"], targets: [{ kind: "fixture", id: "sprite-workbench" }] },
      visual: { glyph: "W", spriteKey: "fixture.basicWorkbench", layer: "fixture" },
      target: { kind: "fixture", id: "sprite-workbench" },
      interactionTargets: [{ kind: "fixture", id: "sprite-workbench" }]
    });
    return {
      title: "High contrast, large markers, sprites",
      cells,
      entities: [
        actor("sprite-slime", largeCells, { spriteKey: "actor.slime.large", pose: "working" }),
        fixture("sprite-workbench", { x: 5, y: 2, z: 0 }, [{ x: 5, y: 2, z: 0 }, { x: 6, y: 2, z: 0 }])
      ],
      effects: [effect("sprite-effect", { x: 5, y: 3, z: 0 }, {
        kind: "hazard", plane: "world", glyph: "!", severity: "serious"
      })],
      overlays: [],
      selection: { target: { kind: "slime", id: "sprite-slime" }, cells: largeCells },
      presentation: {
        tilePx: 30,
        glyphMode: false,
        highContrast: true,
        reducedMotion: true,
        effectIntensity: "strong",
        markerScale: 1.5
      }
    };
  }

  const BUILDERS = Object.freeze({
    terrain: terrainFixture,
    knowledge: knowledgeFixture,
    effects: effectsFixture,
    crowded: crowdedFixture,
    vertical: verticalFixture,
    accessibility: accessibilityFixture
  });

  function createFixture(id) {
    const key = FIXTURE_IDS.includes(String(id)) ? String(id) : "terrain";
    const definition = BUILDERS[key]();
    const z = definition.cells[0]?.cell?.z || 0;
    const viewport = { x: 0, y: 0, z, width: WIDTH, height: HEIGHT };
    const scene = MapVisualState.buildScene({
      clock: 5,
      timeline: { revision: 1, mode: "paused", paused: true, speed: 1 },
      perspective: { kind: "debug", observerId: "parity-fixture" },
      viewport,
      queryBounds: viewport,
      mapSize: { width: WIDTH, height: HEIGHT, tileSizeM: 1, layerHeightM: 3 },
      cells: definition.cells,
      entities: definition.entities,
      effects: definition.effects,
      overlays: definition.overlays,
      selection: definition.selection
    });
    RenderOrder.orderSceneInteractions(scene);
    for (const cell of scene.cells) {
      if (cell.interaction?.primaryTarget) cell.target = cell.interaction.primaryTarget;
    }
    return {
      version: FIXTURE_VERSION,
      id: key,
      title: definition.title,
      scene,
      presentation: {
        tilePx: 24,
        glyphMode: true,
        reducedMotion: true,
        highContrast: false,
        effectIntensity: "standard",
        markerScale: 1,
        includeOverscan: false,
        ...definition.presentation
      }
    };
  }

  function semanticReport(fixtureDefinition, domEntries = []) {
    const { scene, presentation } = fixtureDefinition;
    const errors = [...MapVisualState.validateScene(scene)];
    const plan = CanvasRenderer.prepareDrawPlan(scene, presentation);
    const expectedCells = scene.cells.filter((cell) => MapVisualState.cellInBounds(cell.cell, scene.viewport));
    const domByKey = new Map(domEntries.map((entry) => [entry.key, entry.model]));
    if (domEntries.length !== expectedCells.length) {
      errors.push(`DOM rendered ${domEntries.length} cells; expected ${expectedCells.length}.`);
    }
    const planKeys = [...plan.visibleCellKeys].sort();
    const expectedKeys = expectedCells.map((cell) => cell.key).sort();
    if (JSON.stringify(planKeys) !== JSON.stringify(expectedKeys)) {
      errors.push("Canvas draw-plan cells differ from the visible MapScene cells.");
    }
    for (const cell of expectedCells) {
      const dom = domByKey.get(cell.key);
      if (!dom) {
        errors.push(`DOM omitted cell ${cell.key}.`);
        continue;
      }
      if (dom.dataset.mapKnowledge !== cell.knowledge.state) {
        errors.push(`DOM knowledge mismatch at ${cell.key}.`);
      }
      if (dom.classNames.includes("selected-map-cell") !== Boolean(cell.selected)) {
        errors.push(`DOM selection mismatch at ${cell.key}.`);
      }
      if (dom.classNames.includes("map-cursor-cell") !== Boolean(cell.cursor)) {
        errors.push(`DOM cursor mismatch at ${cell.key}.`);
      }
      if (targetKey(dom.clickTarget) !== targetKey(cell.interaction?.primaryTarget)) {
        errors.push(`DOM primary target mismatch at ${cell.key}.`);
      }
      if (String(dom.text || "") !== String(cell.visual?.glyph || "")) {
        errors.push(`DOM primary glyph mismatch at ${cell.key}.`);
      }
      if (cell.tooltip?.text && !String(dom.title || "").includes(cell.tooltip.text)) {
        errors.push(`DOM tooltip omitted MapScene text at ${cell.key}.`);
      }
      const expectedObjectTargets = (cell.object?.targets || []).map(targetKey).filter(Boolean);
      const domObjectTargets = String(dom.dataset.mapObjectSelectionKeys || "")
        .split(/\s+/)
        .filter(Boolean);
      if (JSON.stringify(domObjectTargets) !== JSON.stringify(expectedObjectTargets)) {
        errors.push(`DOM crowded-target exposure mismatch at ${cell.key}.`);
      }
      const expectedEffectCount = (cell.effectIds || []).reduce((total, effectId) => {
        const effectEntry = scene.effects.find((entry) => entry.id === effectId);
        return total + (effectEntry?.stackCount || 0);
      }, 0);
      if (Number(dom.dataset.mapEffectCount || 0) !== expectedEffectCount) {
        errors.push(`DOM effect count mismatch at ${cell.key}.`);
      }
    }
    const visibleEntityIds = plan.entities.map((entity) => entity.id);
    const visibleEffectIds = plan.effects.map((entry) => entry.id);
    const interactionOrder = scene.interactionIndex.map((entry) => ({
      key: entry.key,
      targets: entry.targets.map(targetKey)
    }));
    return {
      version: FIXTURE_VERSION,
      fixtureId: fixtureDefinition.id,
      errors,
      summary: {
        cells: expectedCells.length,
        entities: visibleEntityIds,
        effects: visibleEffectIds,
        selection: scene.selection.key,
        interactionOrder,
        tooltips: expectedCells
          .filter((cell) => cell.tooltip?.text)
          .map((cell) => [cell.key, cell.tooltip.text]),
        passes: {
          entities: visibleEntityIds.map((id) => {
            const entity = plan.entities.find((entry) => entry.id === id);
            return [id, RenderOrder.passName(RenderOrder.entityPass(entity))];
          }),
          effects: visibleEffectIds.map((id) => {
            const effectEntry = plan.effects.find((entry) => entry.id === id);
            return [id, RenderOrder.passName(RenderOrder.effectPass(effectEntry))];
          })
        },
        drawPlan: { ...plan.stats }
      }
    };
  }

  return {
    FIXTURE_VERSION,
    FIXTURE_IDS,
    createFixture,
    semanticReport
  };
}));
